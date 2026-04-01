import crypto from 'crypto';
import { env } from '../../config/env.js';

function unauthorized(res) {
  res.status(401).json({ error: 'Unauthorized' });
}

function isLoopbackAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const normalized = address.toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '::ffff:127.0.0.1';
}

function shouldBypassAuth(req, options) {
  if (!options.previewMode) {
    return false;
  }

  if (options.allowUnauthenticatedExposedPreview) {
    return true;
  }

  const socketAddress = typeof req?.socket?.remoteAddress === 'string'
    ? req.socket.remoteAddress
    : '';
  return isLoopbackAddress(socketAddress);
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

export function createAuthGuards(options = {}) {
  const authOptions = {
    previewMode: Boolean(options.previewMode),
    allowUnauthenticatedExposedPreview: Boolean(options.allowUnauthenticatedExposedPreview)
  };

  function requireBearerTokenWithOptions(req, res, next) {
    if (shouldBypassAuth(req, authOptions)) {
      next();
      return;
    }

    if (!isAuthorizedApiRequest(req)) {
      unauthorized(res);
      return;
    }

    next();
  }

  function requireBearerTokenOrAccessTokenWithOptions(req, res, next) {
    if (shouldBypassAuth(req, authOptions)) {
      next();
      return;
    }

    if (!isAuthorizedApiRequest(req, { allowQueryAccessToken: true })) {
      unauthorized(res);
      return;
    }

    next();
  }

  return {
    requireBearerToken: requireBearerTokenWithOptions,
    requireBearerTokenOrAccessToken: requireBearerTokenOrAccessTokenWithOptions
  };
}

export function requireBearerToken(req, res, next) {
  return createAuthGuards().requireBearerToken(req, res, next);
}

export function requireBearerTokenOrAccessToken(req, res, next) {
  return createAuthGuards().requireBearerTokenOrAccessToken(req, res, next);
}
