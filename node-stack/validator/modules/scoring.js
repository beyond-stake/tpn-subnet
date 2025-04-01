import { cache, log } from 'mentie'
import { save_ip_address_and_return_ip_stats } from './database.js'
import { is_data_center } from './ip2location.js'
const { CI_MODE } = process.env

/**
 * Scores the uniqueness of a request based on its IP address.
 *
 * @param {Object} request - The request object.
 * @param {string} request.ip - The IP address of the request.
 * @param {string[]} request.ips - The array of IP addresses in  the request.
 * @param {Object} request.connection - The connection object of the request.
 * @param {Object} request.socket - The socket object of the request.
 * @param {Function} request.get - Function to get headers from the request.
 * @returns {Promise<Object|undefined>} - Returns an object containing the uniqueness score and country uniqueness score if successful, otherwise undefined.
 */
export async function score_request_uniqueness( request, disable_rate_limit=false ) {

    // Get the ip of the originating request
    let { ip: request_ip, ips, connection, socket } = request
    let spoofable_ip = request_ip || ips[0] || request.get( 'x-forwarded-for' )
    let unspoofable_ip = connection.remoteAddress || socket.remoteAddress

    // Log out the ip address of the request
    if( unspoofable_ip ) log.info( `Request from ${ unspoofable_ip }` )
    if( !unspoofable_ip ) {
        log.info( `Cannot determine ip address of request, but it might be coming from ${ spoofable_ip } based on headers alone` )
        // return undefined so the calling parent knows there is an issue
        return { uniqueness_score: undefined }
    }

    // Get the geolocation of this ip
    const { default: geoip } = await import( 'geoip-lite' )
    const { country } = geoip.lookup( unspoofable_ip ) || {}
    log.info( `Request from:`, country )

    // If country was undefined, exit with undefined score
    if( !country && !CI_MODE ) {
        log.info( `Cannot determine country of request` )
        return { uniqueness_score: undefined }
    }

    // Check if the last time this ip was seen was within 20 minutes, if it was score as 0 as it indicates multiple miners at the same ip
    const last_seen = cache( `last_seen_${ unspoofable_ip }` )
    const grace_minutes = 11
    const cooldown_minutes = 20 - grace_minutes // Weightset time minus grace window
    const minutes_since_seen = ( Date.now() - last_seen ) / 1000 / 60
    if( !disable_rate_limit && last_seen && minutes_since_seen < cooldown_minutes ) {
        log.info( `Request from ${ unspoofable_ip } seen ${ minutes_since_seen } minutes ago, scoring as 0` )
        return { uniqueness_score: 0 }
    }

    // Save last seen ip to cache
    cache( `last_seen_${ unspoofable_ip }`, Date.now(), cooldown_minutes * 2 * 60 * 1000 )
    
    // Get the connection type and save ip to db
    const [ is_dc, { ip_pct_same_country=0 } ] = await Promise.all( [
        is_data_center( unspoofable_ip ),
        save_ip_address_and_return_ip_stats( { ip_address: unspoofable_ip, country } )
    ] )
    
    // Calcluate the score of the request, datacenters get half scores
    const datacenter_penalty = 0.9
    const country_uniqueness_score = ( 100 - ip_pct_same_country ) * ( is_dc ? datacenter_penalty : 1 )
    log.info( `Country uniqueness: ${ country_uniqueness_score }` )

    // Curve score with a power function where 100 stays 100, but lower numbers get more extreme
    const curve = 5
    const powered_score = Math.pow( country_uniqueness_score / 100, curve ) * 100
    log.info( `Powered score: ${ powered_score }` )

    // Return the score of the request
    return { uniqueness_score: powered_score, country_uniqueness_score }

}
// Datacenter name patterns (including educated guesses)
export const datacenter_patterns = [
    /amazon/i,
    /aws/i,
    /cloudfront/i,
    /google/i,
    /microsoft/i,
    /azure/i,
    /digitalocean/i,
    /linode/i,
    /vultr/i,
    /ovh/i,
    /hetzner/i,
    /upcloud/i,
    /scaleway/i,
    /contabo/i,
    /ionos/i,
    /rackspace/i,
    /softlayer/i,
    /alibaba/i,
    /tencent/i,
    /baidu/i,
    /cloudflare/i,
    /fastly/i,
    /akamai/i,
    /edgecast/i,
    /level3/i,
    /limelight/i,
    /incapsula/i,
    /stackpath/i,
    /maxcdn/i,
    /cloudsigma/i,
    /quadranet/i,
    /psychz/i,
    /choopa/i,
    /leaseweb/i,
    /hostwinds/i,
    /equinix/i,
    /colocrossing/i,
    /hivelocity/i,
    /godaddy/i,
    /bluehost/i,
    /hostgator/i,
    /dreamhost/i,
    /hurricane electric/i,
    // Generic patterns indicating data centers
    /colo/i,
    /datacenter/i,
    /serverfarm/i,
    /hosting/i,
    /cloud\s*services?/i,
    /dedicated\s*server/i,
    /vps/i
]