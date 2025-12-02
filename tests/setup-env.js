// Set NODE_ENV to test FIRST to skip database connection checks
process.env.NODE_ENV = 'test';

// Ensure DATABASE_URL is set BEFORE loading db module
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@neon.example.com/test?sslmode=require';
