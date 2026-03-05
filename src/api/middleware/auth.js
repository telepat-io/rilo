import crypto from 'crypto';
import { env } from '../../config/env.js';

function unauthorized(res) {
  res.status(401).json({ error: 'Unauthorized' });
}

function getTokenFromAuthorizationHeader(req) {
  const authHeader = req.get('authorization');
  if (!authHeader) {
    return '';
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return '';
  }

  return String(match[1] || '').trim();
}

function isMatchingToken(providedToken) {
  const expectedToken = env.apiBearerToken;
  if (!providedToken || !expectedToken) {
    return false;
  }

  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function isAuthorizedApiRequest(req, { allowQueryAccessToken = false } = {}) {
  const headerToken = getTokenFromAuthorizationHeader(req);
  if (isMatchingToken(headerToken)) {
    return true;
  }

  if (!allowQueryAccessToken) {
    return false;
  }

  const queryToken = typeof req.query?.access_token === 'string'
    ? req.query.access_token.trim()
    : '';
  return isMatchingToken(queryToken);
}

export function requireBearerToken(req, res, next) {
  if (!isAuthorizedApiRequest(req)) {
    unauthorized(res);
    return;
  }

  next();
}

export function requireBearerTokenOrAccessToken(req, res, next) {
  if (!isAuthorizedApiRequest(req, { allowQueryAccessToken: true })) {
    unauthorized(res);
    return;
  }

  next();
}
