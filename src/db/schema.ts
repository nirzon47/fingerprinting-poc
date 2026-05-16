import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text().primaryKey().notNull(),
  name: text(),
  email: text().notNull(),
  password: text(),
  emailVerified: timestamp({ mode: 'string' }),
  image: text(),
  created: timestamp({ mode: 'string' }).defaultNow().notNull(),
})

export const session = pgTable(
  'session',
  {
    sessionToken: text().primaryKey().notNull(),
    userId: text().notNull(),
    expires: timestamp({ mode: 'string' }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'session_userId_user_id_fk',
    }).onDelete('cascade'),
  ],
)

export const verificationToken = pgTable(
  'verificationToken',
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ mode: 'string' }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
      name: 'verificationToken_identifier_token_pk',
    }),
  ],
)

export const authenticator = pgTable(
  'authenticator',
  {
    credentialId: text().notNull(),
    userId: text().notNull(),
    providerAccountId: text().notNull(),
    credentialPublicKey: text().notNull(),
    counter: integer().notNull(),
    credentialDeviceType: text().notNull(),
    credentialBackedUp: boolean().notNull(),
    transports: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'authenticator_userId_user_id_fk',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.credentialId, table.userId],
      name: 'authenticator_userId_credentialID_pk',
    }),
    unique('authenticator_credentialID_unique').on(table.credentialId),
  ],
)

export const account = pgTable(
  'account',
  {
    userId: text().notNull(),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text(),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'account_userId_user_id_fk',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.provider, table.providerAccountId],
      name: 'account_provider_providerAccountId_pk',
    }),
  ],
)

export const fingerprints = pgTable('fingerprints', {
  id: uuid().primaryKey().defaultRandom(),
  fingerprint: text().notNull().unique(),
  canvasHash: text('canvas_hash'),
  webglHash: text('webgl_hash'),
  audioHash: text('audio_hash'),
  screenHash: text('screen_hash'),
  hardwareHash: text('hardware_hash'),
  ipAddress: text('ip_address'),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
  accessCount: integer('access_count').default(1).notNull(),
})
