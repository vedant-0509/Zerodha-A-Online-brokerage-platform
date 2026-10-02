

const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const requireRole = require('../middleware/requireRole');
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
router.get('/sync-status', authenticateToken, requireRole('ADMIN'), getMFSyncStatus);

router.post('/orders/buy', authenticateToken, buyMutualFund);
router.post('/orders/sell', authenticateToken, sellMutualFund);
router.get('/holdings', authenticateToken, getMutualFundHoldings);
router.get('/orders', authenticateToken, getMutualFundOrders);

router.post('/sync-now', authenticateToken, requireRole('ADMIN'), triggerSyncNow);
router.post('/sync', authenticateToken, requireRole('ADMIN'), syncLatestNAVController);
router.post('/sync-returns', authenticateToken, requireRole('ADMIN'), syncReturnsController);
router.post('/sync-returns-legacy', authenticateToken, requireRole('ADMIN'), syncReturns);

router.get('/', getMutualFunds);
router.get('/:schemeCode', getMutualFund);

module.exports = router;
