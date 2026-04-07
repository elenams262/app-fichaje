require('dotenv').config();
const express = require('express');
const app = express();
console.log('Express version:', require('./node_modules/express/package.json').version);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Cargada' : '❌ No encontrada');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Cargada' : '❌ No encontrada');
