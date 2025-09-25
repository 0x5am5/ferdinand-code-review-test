import { relations } from "drizzle-orm/relations";
import { clients, brandAssets, users, userPersonas, inspirationSections, inspirationImages, userClients, invitations, figmaConnections, convertedAssets, hiddenSections, figmaDesignTokens, figmaSyncLogs, typeScales, slackWorkspaces, slackUserMappings, apiTokens, slackConversations } from "./schema";

export const brandAssetsRelations = relations(brandAssets, ({one, many}) => ({
	client: one(clients, {
		fields: [brandAssets.clientId],
		references: [clients.id]
	}),
	convertedAssets: many(convertedAssets),
}));

export const clientsRelations = relations(clients, ({one, many}) => ({
	brandAssets: many(brandAssets),
	user_userId: one(users, {
		fields: [clients.userId],
		references: [users.id],
		relationName: "clients_userId_users_id"
	}),
	user_lastEditedBy: one(users, {
		fields: [clients.lastEditedBy],
		references: [users.id],
		relationName: "clients_lastEditedBy_users_id"
	}),
	userPersonas: many(userPersonas),
	inspirationSections: many(inspirationSections),
	userClients: many(userClients),
	figmaConnections: many(figmaConnections),
	hiddenSections: many(hiddenSections),
	typeScales: many(typeScales),
	slackWorkspaces: many(slackWorkspaces),
	slackUserMappings: many(slackUserMappings),
	apiTokens: many(apiTokens),
	slackConversations: many(slackConversations),
}));

export const usersRelations = relations(users, ({many}) => ({
	clients_userId: many(clients, {
		relationName: "clients_userId_users_id"
	}),
	clients_lastEditedBy: many(clients, {
		relationName: "clients_lastEditedBy_users_id"
	}),
	userClients: many(userClients),
	invitations: many(invitations),
	figmaConnections: many(figmaConnections),
	slackWorkspaces: many(slackWorkspaces),
	slackUserMappings: many(slackUserMappings),
	apiTokens: many(apiTokens),
}));

export const userPersonasRelations = relations(userPersonas, ({one}) => ({
	client: one(clients, {
		fields: [userPersonas.clientId],
		references: [clients.id]
	}),
}));

export const inspirationSectionsRelations = relations(inspirationSections, ({one, many}) => ({
	client: one(clients, {
		fields: [inspirationSections.clientId],
		references: [clients.id]
	}),
	inspirationImages: many(inspirationImages),
}));

export const inspirationImagesRelations = relations(inspirationImages, ({one}) => ({
	inspirationSection: one(inspirationSections, {
		fields: [inspirationImages.sectionId],
		references: [inspirationSections.id]
	}),
}));

export const userClientsRelations = relations(userClients, ({one}) => ({
	user: one(users, {
		fields: [userClients.userId],
		references: [users.id]
	}),
	client: one(clients, {
		fields: [userClients.clientId],
		references: [clients.id]
	}),
}));

export const invitationsRelations = relations(invitations, ({one}) => ({
	user: one(users, {
		fields: [invitations.createdById],
		references: [users.id]
	}),
}));

export const figmaConnectionsRelations = relations(figmaConnections, ({one, many}) => ({
	client: one(clients, {
		fields: [figmaConnections.clientId],
		references: [clients.id]
	}),
	user: one(users, {
		fields: [figmaConnections.userId],
		references: [users.id]
	}),
	figmaDesignTokens: many(figmaDesignTokens),
	figmaSyncLogs: many(figmaSyncLogs),
}));

export const convertedAssetsRelations = relations(convertedAssets, ({one}) => ({
	brandAsset: one(brandAssets, {
		fields: [convertedAssets.originalAssetId],
		references: [brandAssets.id]
	}),
}));

export const hiddenSectionsRelations = relations(hiddenSections, ({one}) => ({
	client: one(clients, {
		fields: [hiddenSections.clientId],
		references: [clients.id]
	}),
}));

export const figmaDesignTokensRelations = relations(figmaDesignTokens, ({one}) => ({
	figmaConnection: one(figmaConnections, {
		fields: [figmaDesignTokens.connectionId],
		references: [figmaConnections.id]
	}),
}));

export const figmaSyncLogsRelations = relations(figmaSyncLogs, ({one}) => ({
	figmaConnection: one(figmaConnections, {
		fields: [figmaSyncLogs.connectionId],
		references: [figmaConnections.id]
	}),
}));

export const typeScalesRelations = relations(typeScales, ({one}) => ({
	client: one(clients, {
		fields: [typeScales.clientId],
		references: [clients.id]
	}),
}));

export const slackWorkspacesRelations = relations(slackWorkspaces, ({one}) => ({
	client: one(clients, {
		fields: [slackWorkspaces.clientId],
		references: [clients.id]
	}),
	user: one(users, {
		fields: [slackWorkspaces.installedBy],
		references: [users.id]
	}),
}));

export const slackUserMappingsRelations = relations(slackUserMappings, ({one}) => ({
	user: one(users, {
		fields: [slackUserMappings.ferdinandUserId],
		references: [users.id]
	}),
	client: one(clients, {
		fields: [slackUserMappings.clientId],
		references: [clients.id]
	}),
}));

export const apiTokensRelations = relations(apiTokens, ({one}) => ({
	client: one(clients, {
		fields: [apiTokens.clientId],
		references: [clients.id]
	}),
	user: one(users, {
		fields: [apiTokens.createdBy],
		references: [users.id]
	}),
}));

export const slackConversationsRelations = relations(slackConversations, ({one}) => ({
	client: one(clients, {
		fields: [slackConversations.clientId],
		references: [clients.id]
	}),
}));