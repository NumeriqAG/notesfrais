#!/usr/bin/env node
// Genere une empreinte de mot de passe pour NOTESFRAIS_USERS.
//
//   node scripts/hash-password.mjs 'mon mot de passe'
//
// Colle la sortie dans le champ "passwordHash" du compte, pour ne pas laisser
// de mot de passe en clair dans les variables Vercel.
import { scryptSync, randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error("usage: node scripts/hash-password.mjs '<mot de passe>'");
  process.exit(2);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32);
console.log(`scrypt$${salt.toString('base64')}$${hash.toString('base64')}`);
