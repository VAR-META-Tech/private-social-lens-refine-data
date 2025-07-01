/**
 * Health Monitoring Service
 * Provides system health monitoring, metrics collection, and alerting
 */

import { EventEmitter } from 'events';
import { logger } from './logging.service.js';
import { JobSchedulerService } from './job-scheduler.service.js';
import { BatchStatisticsService } from './batch-statistics.service.js';
import { SystemConfigService } from './system-config.service.js';
import type { PrismaClient } from '@prisma/client';
import os from 'os';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  metrics?: Record<string, number>;
  lastChecked: Date;
  responseTime?: number;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  jobs: {
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
  database: {
    connectionCount: number;
    queryTime: number;
    errorRate: number;
  };
}

export interface AlertConfig {
  name: string;
  enabled: boolean;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq';
  severity: 'warning' | 'critical';
  metric: string;
  description: string;
}

export class HealthMonitoringService extends EventEmitter {
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private metrics: SystemMetrics[] = [];
  private alertConfigs: AlertConfig[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private readonly maxMetricsHistory = 1000;

  constructor(
    private jobScheduler: JobSchedulerService,
    private batchStats: BatchStatisticsService,
    private systemConfig: SystemConfigService,
    private db: PrismaClient
  ) {
    super();
    this.loadConfiguration();
  }

  /**
   * Load configuration from database
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const alerts = await this.systemConfig.getConfig('health.alerts');
      if (alerts) {
        this.alertConfigs = JSON.parse(alerts);
      } else {
        this.alertConfigs = this.getDefaultAlertConfigs();
        await this.systemConfig.setConfig(
          'health.alerts',
          JSON.stringify(this.alertConfigs),
          'Default health monitoring alerts'
        );
      }
    } catch (error) {
      logger.error('Failed to load health monitoring configuration', error as Error, {}, 'HealthMonitor');
      this.alertConfigs = this.getDefaultAlertConfigs();
    }
  }

  /**
   * Get default alert configurations
   */
  private getDefaultAlertConfigs(): AlertConfig[] {
    return [
      {
        name: 'high_cpu_usage',
        enabled: true,
        threshold: 80,
        comparison: 'gt',
        severity: 'warning',
        metric: 'cpu.usage',
        description: 'CPU usage is above 80%'
      },
      {
        name: 'high_memory_usage',
        enabled: true,
        threshold: 85,
        comparison: 'gt',
        severity: 'warning',
        metric: 'memory.percentage',
        description: 'Memory usage is above 85%'
      },
      {
        name: 'job_failure_rate',
        enabled: true,
        threshold: 10,
        comparison: 'gt',
        severity: 'critical',
        metric: 'jobs.failed_percentage',
        description: 'Job failure rate is above 10%'
      }
    ];
  }

  /**
   * Start health monitoring
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Health monitoring is already running', {}, 'HealthMonitor');
      return;
    }

    logger.info('Starting health monitoring', { metadata: { intervalMs } }, 'HealthMonitor');

    this.isMonitoring = true;

    // Perform initial health check
    await this.performFullHealthCheck();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.performFullHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping health monitoring', {}, 'HealthMonitor');

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Perform full health check
   */
  async performFullHealthCheck(): Promise<Record<string, HealthCheckResult>> {
    const startTime = Date.now();

    try {
      // Collect system metrics
      const metrics = await this.collectSystemMetrics();
      this.addMetrics(metrics);

      // Perform individual health checks
      const healthChecks = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkJobSchedulerHealth(),
        this.checkSystemResourceHealth()
      ]);

      const results: Record<string, HealthCheckResult> = {};

      healthChecks.forEach((check, index) => {
        const componentNames = ['database', 'job-scheduler', 'system-resources'];
        const component = componentNames[index];

        if (check.status === 'fulfilled') {
          results[component] = check.value;
          this.healthChecks.set(component, check.value);

          if (check.value.status !== 'healthy') {
            this.emit('health-check-failed', check.value);
          }
        } else {
          const errorResult: HealthCheckResult = {
            component,
            status: 'critical',
            message: `Health check failed: ${check.reason}`,
            lastChecked: new Date()
          };
          results[component] = errorResult;
          this.healthChecks.set(component, errorResult);
          this.emit('health-check-failed', errorResult);
        }
      });

      // Check alert thresholds
      this.checkAlertThresholds(metrics);

      const duration = Date.now() - startTime;
      logger.info('Health check completed', {
        duration,
        metadata: {
          componentsChecked: Object.keys(results).length,
          healthyComponents: Object.values(results).filter(r => r.status === 'healthy').length
        }
      }, 'HealthMonitor');

      return results;

    } catch (error) {
      logger.error('Failed to perform health check', error as Error, {}, 'HealthMonitor');
      throw error;
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const [
      cpuUsage,
      memoryInfo,
      jobStats,
      dbStats
    ] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryInfo(),
      this.getJobStatistics(),
      this.getDatabaseStatistics()
    ]);

    return {
      timestamp: new Date(),
      cpu: cpuUsage,
      memory: memoryInfo,
      jobs: jobStats,
      database: dbStats
    };
  }

  /**
   * Get CPU usage information
   */
  private async getCpuUsage(): Promise<{ usage: number; loadAverage: number[] }> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        const totalTime = (endTime - startTime) * 1000; // Convert to microseconds

        const cpuPercent = ((endUsage.user + endUsage.system) / totalTime) * 100;

        resolve({
          usage: Math.round(cpuPercent * 100) / 100,
          loadAverage: os.loadavg()
        });
      }, 100);
    });
  }

  /**
   * Get memory usage information
   */
  private getMemoryInfo(): { total: number; used: number; free: number; percentage: number } {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = Math.round((used / total) * 100 * 100) / 100;

    return { total, used, free, percentage };
  }

  /**
   * Get job statistics
   */
  private async getJobStatistics(): Promise<{
    active: number;
    queued: number;
    completed: number;
    failed: number;
  }> {
    try {
      const jobs = await this.jobScheduler.getAllJobs();

      return {
        active: jobs.filter(j => j.status === 'RUNNING').length,
        queued: jobs.filter(j => j.status === 'PENDING').length,
        completed: jobs.filter(j => j.status === 'COMPLETED').length,
        failed: jobs.filter(j => j.status === 'FAILED').length
      };
    } catch (error) {
      logger.error('Failed to get job statistics', error as Error, {}, 'HealthMonitor');
      return { active: 0, queued: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Get database statistics
   */
  private async getDatabaseStatistics(): Promise<{
    connectionCount: number;
    queryTime: number;
    errorRate: number;
  }> {
    try {
      const startTime = Date.now();
      await this.db.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - startTime;

      return {
        connectionCount: 1,
        queryTime,
        errorRate: 0
      };
    } catch (error) {
      logger.error('Failed to get database statistics', error as Error, {}, 'HealthMonitor');
      return { connectionCount: 0, queryTime: 9999, errorRate: 100 };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.db.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        component: 'database',
        status: responseTime < 1000 ? 'healthy' : 'warning',
        message: `Database responding in ${responseTime}ms`,
        responseTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        component: 'database',
        status: 'critical',
        message: `Database connection failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check job scheduler health
   */
  private async checkJobSchedulerHealth(): Promise<HealthCheckResult> {
    try {
      const jobs = await this.jobScheduler.getAllJobs();
      const runningJobs = jobs.filter(j => j.status === 'RUNNING');
      const failedJobs = jobs.filter(j => j.status === 'FAILED');

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `${jobs.length} total jobs, ${runningJobs.length} running`;

      if (failedJobs.length > 5) {
        status = 'warning';
        message += `, ${failedJobs.length} failed`;
      }

      if (runningJobs.length > 10) {
        status = 'warning';
        message += ' (high job count)';
      }

      return {
        component: 'job-scheduler',
        status,
        message,
        metrics: {
          totalJobs: jobs.length,
          runningJobs: runningJobs.length,
          failedJobs: failedJobs.length
        },
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        component: 'job-scheduler',
        status: 'critical',
        message: `Job scheduler error: ${(error as Error).message}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check system resource health
   */
  private async checkSystemResourceHealth(): Promise<HealthCheckResult> {
    const memory = this.getMemoryInfo();
    const cpu = await this.getCpuUsage();

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    if (memory.percentage > 90) {
      status = 'critical';
      issues.push(`memory at ${memory.percentage}%`);
    } else if (memory.percentage > 80) {
      status = 'warning';
      issues.push(`memory at ${memory.percentage}%`);
    }

    if (cpu.usage > 90) {
      status = 'critical';
      issues.push(`CPU at ${cpu.usage}%`);
    } else if (cpu.usage > 80) {
      status = 'warning';
      issues.push(`CPU at ${cpu.usage}%`);
    }

    const message = issues.length > 0
      ? `High resource usage: ${issues.join(', ')}`
      : `CPU: ${cpu.usage}%, Memory: ${memory.percentage}%`;

    return {
      component: 'system-resources',
      status,
      message,
      metrics: {
        cpuUsage: cpu.usage,
        memoryPercentage: memory.percentage,
        loadAverage: cpu.loadAverage[0]
      },
      lastChecked: new Date()
    };
  }

  /**
   * Add metrics to history
   */
  private addMetrics(metrics: SystemMetrics): void {
    this.metrics.push(metrics);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log metrics for external aggregation
    logger.logMetrics({
      cpu: metrics.cpu,
      memory: metrics.memory,
      jobs: metrics.jobs,
      database: metrics.database
    });
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(metrics: SystemMetrics): void {
    for (const alert of this.alertConfigs) {
      if (!alert.enabled) continue;

      const value = this.getMetricValue(metrics, alert.metric);
      if (value === undefined) continue;

      let triggered = false;

      switch (alert.comparison) {
        case 'gt':
          triggered = value > alert.threshold;
          break;
        case 'lt':
          triggered = value < alert.threshold;
          break;
        case 'eq':
          triggered = value === alert.threshold;
          break;
      }

      if (triggered) {
        this.emit('metric-threshold-exceeded', alert, value);
      }
    }
  }

  /**
   * Get metric value by path
   */
  private getMetricValue(metrics: SystemMetrics, path: string): number | undefined {
    const keys = path.split('.');
    let value: any = metrics;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  /**
   * Send basic notification (placeholder)
   */
  private async sendAlert(result: HealthCheckResult): Promise<void> {
    logger.warn('Health alert triggered', {
      component: result.component,
      metadata: {
        status: result.status,
        message: result.message
      }
    }, 'HealthMonitor');
  }

  /**
   * Send threshold alert (placeholder)
   */
  private async sendThresholdAlert(alert: AlertConfig, value: number): Promise<void> {
    logger.warn('Threshold alert triggered', {
      metadata: {
        alertName: alert.name,
        threshold: alert.threshold,
        actualValue: value,
        severity: alert.severity
      }
    }, 'HealthMonitor');
  }

  /**
   * Get current health status
   */
  getHealthStatus(): Record<string, HealthCheckResult> {
    const status: Record<string, HealthCheckResult> = {};

    for (const [component, result] of this.healthChecks) {
      status[component] = result;
    }

    return status;
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 10): SystemMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Update alert configurations
   */
  async updateAlertConfigs(alerts: AlertConfig[]): Promise<void> {
    this.alertConfigs = alerts;

    await this.systemConfig.setConfig(
      'health.alerts',
      JSON.stringify(alerts),
      'Health monitoring alert configurations'
    );

    logger.info('Alert configurations updated', { metadata: { alertCount: alerts.length } }, 'HealthMonitor');
  }
}
