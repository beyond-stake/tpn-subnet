// Set up environment
import 'dotenv/config'
import { log } from 'mentie'
log.info( `Starting server with env`, process.env )

// Initialise database
import { init_tables } from './modules/database.js'
log.info( 'Initialising database tables' )
await init_tables()
log.info( 'Database tables initialised' )

// Import express
import { app } from './routes/server.js'
log.info( `Setting up routes` )

// Identify self on /
app.get( '/', ( req, res ) => res.send( 'Challenge-response server' ) )

// Import challenge/response router
import { router as challenge_response_router } from './routes/challenge-response.js'
app.use( '/challenge', challenge_response_router )

// Import wireguard router
import { router as wireguard_router } from './routes/wireguard.js'
app.use( '/wireguard', wireguard_router )

// Start the server
const { PORT=3001 } = process.env
const server = app.listen( PORT, () => log.info( `Server started on port ${ PORT }` ) )
const handle_close = () => {
    log.info( 'Closing server' )
    server.close()
    process.exit( 0 )
}
process.on( 'SIGTERM', handle_close )
process.on( 'SIGINT', handle_close )