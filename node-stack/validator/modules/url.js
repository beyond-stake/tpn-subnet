import { log } from "mentie"

const { PUBLIC_URL, PUBLIC_VALIDATOR_URL='validator', PUBLIC_PORT=3000, CI_MODE } = process.env

// Base url based on environment
let base_url = PUBLIC_VALIDATOR_URL || PUBLIC_URL

// If CI_MODE is enabled, use docker container name
// if( CI_MODE ) {
//     log.warn( `CI_MODE is enabled, using docker container name as base url` )
//     base_url = `http://validator`
// }

// Remove trailing slash
base_url = `${ base_url }`.replace( /\/$/, '' )

// Check if public url has a port
const has_port = `${ base_url }`.match( /:\d*$/ )

if( has_port && PUBLIC_PORT ) log.error( `You specified a PUBLIC_PORT=${ PUBLIC_PORT } but your base url ${ PUBLIC_VALIDATOR_URL } also has a port specified, this will break!` )

if( PUBLIC_PORT && !base_url.includes( `:${ PUBLIC_PORT }` ) ) {
    log.info( `Adding port ${ PUBLIC_PORT } to base url` )
    base_url = `${ base_url }:${ PUBLIC_PORT }`
}

export { base_url }