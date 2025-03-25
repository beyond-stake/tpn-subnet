import express from 'express'
export const app = express()

// Add body parser for post requests
app.use( express.json() )
