// const express = require('express');
// const {
//   getMutualFunds,
//   getMutualFundFilters,
//   getMutualFund,
//   buyMutualFund,
//   sellMutualFund,
//   getMutualFundHoldings,
//   getMutualFundOrders,
//   syncLatestNAVController,
//   syncReturnsController,
//   syncReturns,
//   getMFSyncStatus,
//   triggerSyncNow,
//     getTopReturns,
// } = require('./mutualFundController');

// const router = express.Router();

// router.get('/filters', getMutualFundFilters);
// router.get('/top-returns', getTopReturns);
// router.get('/sync-status', getMFSyncStatus);
// router.post('/sync-now', triggerSyncNow);
// router.post('/orders/buy', buyMutualFund);
// router.post('/orders/sell', sellMutualFund);
// router.get('/holdings/:userId', getMutualFundHoldings);
// router.get('/orders/:userId', getMutualFundOrders);
// router.post('/sync', syncLatestNAVController);
// router.post('/sync-returns', syncReturnsController);
// router.post('/sync-returns-legacy', syncReturns);
// router.get('/', getMutualFunds);
// router.get('/:schemeCode', getMutualFund);

// module.exports = router;





const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const {
  getMutualFunds,
  getMutualFundFilters,
  getMutualFund,
  buyMutualFund,
  sellMutualFund,
  getMutualFundHoldings,
  getMutualFundOrders,
  syncLatestNAVController,
  syncReturnsController,
  syncReturns,
  getMFSyncStatus,
  triggerSyncNow,
    getTopReturns,
} = require('./mutualFundController');

const router = express.Router();

router.get('/filters', getMutualFundFilters);
router.get('/top-returns', getTopReturns);
router.get('/sync-status', getMFSyncStatus);
router.post('/sync-now', triggerSyncNow);
router.post('/orders/buy', authenticateToken, buyMutualFund);
router.post('/orders/sell', authenticateToken, sellMutualFund);
router.get('/holdings', authenticateToken, getMutualFundHoldings);
router.get('/orders', authenticateToken, getMutualFundOrders);
router.post('/sync', syncLatestNAVController);
router.post('/sync-returns', syncReturnsController);
router.post('/sync-returns-legacy', syncReturns);
router.get('/', getMutualFunds);
router.get('/:schemeCode', getMutualFund);

module.exports = router;