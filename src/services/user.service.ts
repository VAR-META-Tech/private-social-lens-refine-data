import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from './logging.service'
import * as bcrypt from 'bcrypt'
import { generateJwtToken } from '@/api/middleware/auth'
import { createApiError } from '@/api/middleware/error-handler'

export interface CreateUserDto {
  email: string
  password: string
  name?: string
  role?: 'USER' | 'ADMIN' | 'SYSTEM'
}

export interface UpdateUserDto {
  name?: string
  email?: string
  password?: string
  role?: 'USER' | 'ADMIN' | 'SYSTEM'
  isActive?: boolean
}

export interface UserResponse {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'ADMIN' | 'SYSTEM'
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new user
   */
  async createUser(data: CreateUserDto): Promise<UserResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email }
      })

      if (existingUser) {
        throw createApiError('User already exists', 409, 'USER_EXISTS')
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10)

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          role: data.role || 'USER'
        }
      })

      logger.info('User created successfully', {
        operation: 'create-user',
        metadata: { userId: user.id }
      })

      return this.sanitizeUser(user)
    } catch (error) {
      logger.error('Failed to create user', error as Error, {
        operation: 'create-user'
      })
      throw error
    }
  }

  /**
   * Update a user
   */
  async updateUser(userId: string, data: UpdateUserDto): Promise<UserResponse> {
    try {
      const updateData: any = { ...data }

      // If password is being updated, hash it
      if (data.password) {
        updateData.passwordHash = await bcrypt.hash(data.password, 10)
        delete updateData.password
      }

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: updateData
      })

      logger.info('User updated successfully', {
        operation: 'update-user',
        metadata: { userId }
      })

      return this.sanitizeUser(user)
    } catch (error) {
      logger.error('Failed to update user', error as Error, {
        operation: 'update-user',
        metadata: { userId }
      })
      throw error
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      })

      return user ? this.sanitizeUser(user) : null
    } catch (error) {
      logger.error('Failed to get user', error as Error, {
        operation: 'get-user',
        metadata: { userId }
      })
      throw error
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email }
      })

      return user ? this.sanitizeUser(user) : null
    } catch (error) {
      logger.error('Failed to get user by email', error as Error, {
        operation: 'get-user-by-email'
      })
      throw error
    }
  }

  /**
   * Authenticate user and return JWT token
   */
  async authenticateUser(email: string, password: string): Promise<{ user: UserResponse; token: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email }
      })

      if (!user || !user.isActive) {
        throw createApiError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
      if (!isPasswordValid) {
        throw createApiError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }

      // Update last login time
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      // Generate JWT token
      const token = generateJwtToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      })

      logger.info('User authenticated successfully', {
        operation: 'authenticate-user',
        metadata: { userId: user.id }
      })

      return {
        user: this.sanitizeUser(user),
        token
      }
    } catch (error) {
      logger.error('Failed to authenticate user', error as Error, {
        operation: 'authenticate-user'
      })
      throw error
    }
  }

  /**
   * List users with pagination
   */
  async listUsers(page: number = 1, limit: number = 10): Promise<{ users: UserResponse[]; total: number }> {
    try {
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.user.count()
      ])

      return {
        users: users.map(this.sanitizeUser),
        total
      }
    } catch (error) {
      logger.error('Failed to list users', error as Error, {
        operation: 'list-users'
      })
      throw error
    }
  }

  /**
   * Delete a user (soft delete by setting isActive to false)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      })

      logger.info('User deleted successfully', {
        operation: 'delete-user',
        metadata: { userId }
      })
    } catch (error) {
      logger.error('Failed to delete user', error as Error, {
        operation: 'delete-user',
        metadata: { userId }
      })
      throw error
    }
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: any): UserResponse {
    const { passwordHash, ...sanitizedUser } = user
    return sanitizedUser
  }
} 