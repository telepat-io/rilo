import express from 'express';

export function createWebhookRouter() {
  const router = express.Router();

  router.post('/replicate', (req, res) => {
    res.status(501).json({
      error: 'Webhook handling is disabled until signature verification and durable queue reconciliation are implemented'
    });
  });

  return router;
}
