// Slack Command Types
export interface SlackCommand {
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  api_app_id: string;
  response_url: string;
  trigger_id: string;
}

export interface SlackUser {
  id: string;
  username?: string;
  name?: string;
  team_id?: string;
}

export interface SlackTeam {
  id: string;
  domain?: string;
}

export interface SlackChannel {
  id: string;
  name?: string;
}

export interface SlackAction {
  action_id: string;
  block_id?: string;
  value?: string;
  type?: string;
  action_ts?: string;
}

export interface SlackInteractionBody {
  type: string;
  user: SlackUser;
  team: SlackTeam;
  channel: SlackChannel;
  actions: SlackAction[];
  trigger_id?: string;
  response_url?: string;
  token?: string;
  api_app_id?: string;
}

export type SlackAckFn = () => Promise<void>;

export type SlackRespondFn = (message: {
  text?: string;
  blocks?: unknown[];
  response_type?: "ephemeral" | "in_channel";
  replace_original?: boolean;
}) => Promise<void>;

export interface SlackCommandArgs {
  command: SlackCommand;
  ack: SlackAckFn;
  respond: SlackRespondFn;
  client: unknown; // WebClient from @slack/web-api
}

export interface SlackInteractionArgs {
  body: SlackInteractionBody;
  ack: SlackAckFn;
  respond: SlackRespondFn;
  client: unknown; // WebClient from @slack/web-api
}

export interface SlackWorkspace {
  id: number;
  clientId: number;
  slackTeamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  installedBy: number | null;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SlackAuditLog {
  userId: string;
  workspaceId: string;
  ferdinandUserId?: number;
  command: string;
  assetIds: number[];
  clientId: number;
  success: boolean;
  responseTimeMs?: number;
  timestamp: Date;
  error?: string;
}
