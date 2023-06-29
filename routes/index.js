var express = require('express');
var router = express.Router();
var {Check} = require('../models/Check');
const { reclaimprotocol } = require( '@reclaimprotocol/reclaim-sdk');
const bodyParser = require('body-parser');
const reclaim = new reclaimprotocol.Reclaim();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { });
});

router.post('/checks', async (req, res) => {
  const check = new Check();
  check.data = {};
  await check.save();

  res.redirect(`/checks/${check.checkId}/verify`);
});

router.get('/checks/:checkId/prove', async (req, res) => {
  res.render('prove', {checkId: req.params.checkId});
});

router.post('/checks/:checkId/prove', async (req, res) => {
  const check = await Check.findOne({ checkId: req.params.checkId });
  check.data = { country: req.body.country };
  await check.save();
  
  res.redirect(`/checks/${check.checkId}/zkprove`);
});

router.get('/checks/:checkId/zkprove', async (req, res) => {
  const check = await Check.findOne({ checkId: req.params.checkId });
  const { country } = check.data;
  if (country === 'IN') {
    const request = reclaim.requestProofs({
        title: "Reclaim Protocol",
        baseCallbackUrl: process.env.BASE_URL + "/checks/zkprove",
        callbackId: check.checkId,
        requestedProofs: [
          new reclaim.CustomProvider({
            provider: 'google-login',
            payload: {}
        }),
      ],
    });

    const { callbackId, reclaimUrl, expectedProofsInCallback } = request;
    check.data.request = { callbackId, reclaimUrl, expectedProofsInCallback };
    await check.save();
    return res.redirect(reclaimUrl);
  }
  res.render('zkprove', {check, request});
});

router.post('/checks/zkprove', bodyParser.text("*/*"), async (req, res) => {
  console.log(Object.keys(req.body)[0]);
  const callbackId = req.query.id;
  const check = await Check.findOne({ checkId: callbackId });
  check.data.proofs = JSON.parse(Object.keys(req.body)[0]).proofs;
  await check.save();
  
  const onChainClaimIds = reclaim.getOnChainClaimIdsFromProofs(check.data.proofs);
  const isProofsCorrect = await reclaim.verifyCorrectnessOfProofs(check.data.proofs);
  if (isProofsCorrect) {
    check.data.proofParams = check.data.proofs.map(proof => proof.parameters);
  }
  await check.save();
  res.redirect(`/checks/${check.checkId}/verify`);
});



router.get('/checks/:checkId/verify', async (req, res) => {
  const check = await Check.findOne({ checkId: req.params.checkId });
  res.render('verify', {check});
});


module.exports = router;
