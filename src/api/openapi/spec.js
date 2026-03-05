function jsonContent(schema) {
  return {
    'application/json': {
      schema
    }
  };
}

const schemas = {
  ErrorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string' }
    },
    required: ['error'],
    additionalProperties: true
  },
  HealthResponse: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      service: { type: 'string' }
    },
    required: ['ok', 'service'],
    additionalProperties: true
  },
  JobCreateRequest: {
    type: 'object',
    properties: {
      story: { type: 'string' },
      project: { type: 'string' },
      forceRestart: { type: 'boolean' }
    },
    required: ['story'],
    additionalProperties: true
  },
  JobCreateAccepted: {
    type: 'object',
    properties: {
      jobId: { type: 'string' },
      status: { type: 'string' }
    },
    required: ['jobId', 'status'],
    additionalProperties: true
  },
  ProjectsListResponse: {
    type: 'object',
    properties: {
      projects: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['projects'],
    additionalProperties: true
  },
  ProjectCreateRequest: {
    type: 'object',
    properties: {
      project: { type: 'string' },
      story: { type: 'string' },
      config: { type: 'object', additionalProperties: true },
      metadata: { type: 'object', additionalProperties: true }
    },
    required: ['project'],
    additionalProperties: true
  },
  MetadataPatchRequest: {
    type: 'object',
    properties: {
      metadata: { type: 'object', additionalProperties: true }
    },
    required: ['metadata'],
    additionalProperties: true
  },
  ProjectConfigPatchRequest: {
    type: 'object',
    properties: {
      config: {
        type: 'object',
        properties: {
          aspectRatio: { type: 'string', enum: ['9:16', '16:9', '1:1'] },
          targetDurationSec: { type: 'integer', minimum: 5, maximum: 600 },
          finalDurationMode: { type: 'string', enum: ['match_audio', 'match_visual'] },
          keyframeWidth: { type: 'integer', minimum: 64, maximum: 2048 },
          keyframeHeight: { type: 'integer', minimum: 64, maximum: 2048 },
          models: {
            type: 'object',
            properties: {
              textToText: { type: 'string', enum: ['deepseek-ai/deepseek-v3'] },
              textToSpeech: { type: 'string', enum: ['minimax/speech-02-turbo'] },
              textToImage: { type: 'string', enum: ['prunaai/z-image-turbo'] },
              imageTextToVideo: { type: 'string', enum: ['wan-video/wan-2.2-i2v-fast'] }
            },
            additionalProperties: false
          }
        },
        required: ['aspectRatio', 'targetDurationSec', 'finalDurationMode'],
        additionalProperties: false
      }
    },
    required: ['config'],
    additionalProperties: true
  },
  ProjectContentPatchRequest: {
    type: 'object',
    properties: {
      story: { type: 'string' },
      script: { type: 'string' },
      shots: {
        type: 'array',
        items: { type: 'string' }
      },
      prompts: {
        type: 'array',
        items: { type: 'string' }
      },
      tone: { type: 'string' }
    },
    additionalProperties: true
  },
  ProjectRegenerateRequest: {
    type: 'object',
    properties: {
      forceRestart: { type: 'boolean' },
      targetType: {
        type: 'string',
        enum: ['script', 'voiceover', 'keyframe', 'segment']
      },
      index: {
        type: 'integer',
        minimum: 0
      }
    },
    additionalProperties: true
  },
  GenericObjectResponse: {
    type: 'object',
    additionalProperties: true
  }
};

export function buildOpenApiSpec({ baseUrl = 'http://localhost:3000' } = {}) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'VIDEOGEN API',
      version: '0.1.0',
      description: 'API for VIDEOGEN jobs, projects metadata, and operational endpoints.'
    },
    servers: [{ url: baseUrl }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Token'
        }
      },
      schemas
    },
    paths: {
      '/health': {
        get: {
          summary: 'Service health check',
          security: [],
          responses: {
            200: {
              description: 'Service is healthy',
              content: jsonContent({ $ref: '#/components/schemas/HealthResponse' })
            }
          }
        }
      },
      '/openapi.json': {
        get: {
          summary: 'Get OpenAPI document',
          security: [],
          responses: {
            200: {
              description: 'OpenAPI document',
              content: jsonContent({ type: 'object', additionalProperties: true })
            }
          }
        }
      },
      '/docs': {
        get: {
          summary: 'OpenAPI Swagger UI',
          security: [],
          responses: {
            200: {
              description: 'Swagger UI HTML',
              content: {
                'text/html': {
                  schema: { type: 'string' }
                }
              }
            }
          }
        }
      },
      '/webhooks/replicate': {
        post: {
          summary: 'Replicate webhook callback (currently disabled)',
          security: [],
          requestBody: {
            required: false,
            content: jsonContent({ type: 'object', additionalProperties: true })
          },
          responses: {
            501: {
              description: 'Webhook handling not implemented',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/jobs': {
        post: {
          summary: 'Create a new generation job',
          requestBody: {
            required: true,
            content: jsonContent({ $ref: '#/components/schemas/JobCreateRequest' })
          },
          responses: {
            202: {
              description: 'Job accepted',
              content: jsonContent({ $ref: '#/components/schemas/JobCreateAccepted' })
            },
            400: {
              description: 'Invalid request',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            409: {
              description: 'Project has active job',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            }
          }
        }
      },
      '/jobs/{jobId}': {
        get: {
          summary: 'Get job status',
          parameters: [
            {
              name: 'jobId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Job details',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            404: {
              description: 'Job not found',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects': {
        get: {
          summary: 'List projects',
          responses: {
            200: {
              description: 'Projects list',
              content: jsonContent({ $ref: '#/components/schemas/ProjectsListResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            500: {
              description: 'Backend failure',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        },
        post: {
          summary: 'Create or initialize project metadata',
          requestBody: {
            required: true,
            content: jsonContent({ $ref: '#/components/schemas/ProjectCreateRequest' })
          },
          responses: {
            201: {
              description: 'Project created',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}': {
        get: {
          summary: 'Get project details',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Project details',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            404: {
              description: 'Project not found',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/assets/{assetPath}': {
        get: {
          summary: 'Read a local project asset file over HTTP',
          description: 'For local backend only. Supports Authorization Bearer token or access_token query parameter for media tags.',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'assetPath',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Project-relative file path (nested paths supported).'
            },
            {
              name: 'access_token',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Alternative to Authorization header for browser media tags.'
            }
          ],
          responses: {
            200: {
              description: 'Asset file content',
              content: {
                '*/*': {
                  schema: {
                    type: 'string',
                    format: 'binary'
                  }
                }
              }
            },
            400: {
              description: 'Validation error or non-local backend',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            404: {
              description: 'Asset not found',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/config': {
        patch: {
          summary: 'Update project config (aspect ratio, duration, keyframe dimensions)',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: jsonContent({ $ref: '#/components/schemas/ProjectConfigPatchRequest' })
          },
          responses: {
            200: {
              description: 'Config updated and synced',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/metadata': {
        patch: {
          summary: 'Update project metadata',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: jsonContent({ $ref: '#/components/schemas/MetadataPatchRequest' })
          },
          responses: {
            200: {
              description: 'Metadata updated',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/content': {
        patch: {
          summary: 'Update project story/script/shots/tone content',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: jsonContent({ $ref: '#/components/schemas/ProjectContentPatchRequest' })
          },
          responses: {
            200: {
              description: 'Project content updated and synced',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/regenerate': {
        post: {
          summary: 'Regenerate project assets or a specific script/voiceover/keyframe/segment target',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: false,
            content: jsonContent({ $ref: '#/components/schemas/ProjectRegenerateRequest' })
          },
          responses: {
            200: {
              description: 'Targeted script/voiceover/keyframe/segment regenerated and downstream marked dirty',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            202: {
              description: 'Regeneration job accepted',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            409: {
              description: 'Project has active job',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            }
          }
        }
      },
      '/projects/{project}/logs': {
        get: {
          summary: 'Get model request logs',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'includeEntries',
              in: 'query',
              required: false,
              schema: { type: 'boolean' }
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1 }
            }
          ],
          responses: {
            200: {
              description: 'Logs response',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/prompts': {
        get: {
          summary: 'Get extracted prompts from script/logs',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1 }
            }
          ],
          responses: {
            200: {
              description: 'Prompt extraction response',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/artifacts': {
        get: {
          summary: 'Get artifacts manifest',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Artifacts manifest',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/sync': {
        get: {
          summary: 'Get backend sync state',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Sync status',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/snapshots': {
        get: {
          summary: 'List project snapshots',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Snapshots list',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/analytics': {
        get: {
          summary: 'Get project analytics summary',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Analytics summary',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/analytics/runs': {
        get: {
          summary: 'List analytics runs',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1 }
            }
          ],
          responses: {
            200: {
              description: 'Analytics runs',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            400: {
              description: 'Validation error',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      },
      '/projects/{project}/analytics/runs/{runId}': {
        get: {
          summary: 'Get analytics run detail',
          parameters: [
            {
              name: 'project',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'runId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Analytics run detail',
              content: jsonContent({ $ref: '#/components/schemas/GenericObjectResponse' })
            },
            401: {
              description: 'Missing or invalid bearer token',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            },
            404: {
              description: 'Run not found',
              content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
            }
          }
        }
      }
    }
  };
}
