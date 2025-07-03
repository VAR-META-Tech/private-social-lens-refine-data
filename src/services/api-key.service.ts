import { PrismaClient } from '@/generated/prisma'
import { logger } from './logging.service'
import { createHash, randomBytes } from 'crypto'

export interface CreateApiKeyDto {
  name: string
  description?: string
  expiresAt?: Date
}

export interface UpdateApiKeyDto {
  name?: string
  description?: string
  isActive?: boolean
}

export interface ApiKeyResponse {
  id: string
  name: string
  keyHint: string
  description?: string | null
  isActive: boolean
  expiresAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export class ApiKeyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Hash API key for secure storage
   */
  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  /**
   * Generate a new API key
   */
  private generateApiKey(): { key: string; hint: string } {
    const key = Buffer.from(randomBytes(32)).toString('base64').replace(/[+/=]/g, '')
    const hint = key.substring(0, 8) // First 8 characters as hint
    return { key, hint }
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: CreateApiKeyDto) {
    const { key, hint } = this.generateApiKey()
    const hash = this.hashApiKey(key)

    try {
      const apiKey = await this.prisma.apiKey.create({
        data: {
          name: data.name,
          description: data.description,
          keyHash: hash,
          keyHint: hint,
          expiresAt: data.expiresAt
        }
      })

      logger.info('Created new API key', {
        operation: 'create-api-key',
        metadata: {
          id: apiKey.id,
          name: apiKey.name,
          hint: apiKey.keyHint
        }
      })

      // Return the full key - this is the only time it will be available
      return {
        ...apiKey,
        key
      }
    } catch (error) {
      logger.error('Failed to create API key', error as Error, {
        operation: 'create-api-key',
        metadata: { name: data.name }
      })
      throw error
    }
  }

  /**
   * Validate an API key
   */
  async validateApiKey(key: string): Promise<ApiKeyResponse | null> {
    if (!key) return null

    const hash = this.hashApiKey(key)

    try {
      const apiKey = await this.prisma.apiKey.findFirst({
        where: {
          keyHash: hash,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      })

      if (!apiKey) {
        logger.warn('Invalid API key attempt', {
          operation: 'validate-api-key',
          metadata: { hash }
        })
        return null
      }

      return apiKey
    } catch (error) {
      logger.error('Failed to validate API key', error as Error, {
        operation: 'validate-api-key'
      })
      return null
    }
  }

  /**
   * Deactivate an API key
   */
  async deactivateApiKey(id: string): Promise<boolean> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { isActive: false }
      })

      logger.info('Deactivated API key', {
        operation: 'deactivate-api-key',
        metadata: { id }
      })

      return true
    } catch (error) {
      logger.error('Failed to deactivate API key', error as Error, {
        operation: 'deactivate-api-key',
        metadata: { id }
      })
      return false
    }
  }

  /**
   * List all API keys
   */
  async listApiKeys(): Promise<ApiKeyResponse[]> {
    try {
      return await this.prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' }
      })
    } catch (error) {
      logger.error('Failed to list API keys', error as Error, {
        operation: 'list-api-keys'
      })
      throw error
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(id: string): Promise<ApiKeyResponse | null> {
    try {
      return await this.prisma.apiKey.findUnique({
        where: { id }
      })
    } catch (error) {
      logger.error('Failed to get API key', error as Error, {
        operation: 'get-api-key',
        metadata: { id }
      })
      return null
    }
  }

  /**
   * Update an API key
   */
  async updateApiKey(id: string, data: UpdateApiKeyDto): Promise<boolean> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { isActive: data.isActive })
        }
      })

      logger.info('Updated API key', {
        operation: 'update-api-key',
        metadata: { id, updates: Object.keys(data) }
      })

      return true
    } catch (error) {
      logger.error('Failed to update API key', error as Error, {
        operation: 'update-api-key',
        metadata: { id }
      })
      return false
    }
  }

  /**
   * Activate an API key
   */
  async activateApiKey(id: string): Promise<boolean> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { isActive: true }
      })

      logger.info('Activated API key', {
        operation: 'activate-api-key',
        metadata: { id }
      })

      return true
    } catch (error) {
      logger.error('Failed to activate API key', error as Error, {
        operation: 'activate-api-key',
        metadata: { id }
      })
      return false
    }
  }
} 