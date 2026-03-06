import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.client = createClient(
      configService.getOrThrow<string>('SUPABASE_URL'),
      configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  async onModuleInit() {
    const { error } = await this.client.from('profiles').select('id').limit(1);
    if (error) {
      this.logger.error(`Supabase connection check failed: ${error.message}`);
      throw error;
    }
    this.logger.log('Supabase connection established (super-admin backend)');
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
