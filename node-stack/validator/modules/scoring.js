import { cache, log } from 'mentie'
import { is_data_center } from './ip2location.js'
const { CI_MODE } = process.env

export const ip_from_req = ( request ) => {
    let { ip: request_ip, ips, connection, socket } = request
    let spoofable_ip = request_ip || ips[0] || request.get( 'x-forwarded-for' )
    let unspoofable_ip = connection.remoteAddress || socket.remoteAddress
    return { unspoofable_ip, spoofable_ip }
}

async function score_ip_uniqueness( ip ) {

    // Get the geolocation of this ip
    const miner_data = cache( `miner_ip_to_country` ) || {}
    let { country } = miner_data[ ip ] || {}
    log.info( `Request from:`, country )

    // If country is missing, try to resolve it once more
    if( !country ) {
        try {
            const { default: geoip } = await import( 'geoip-lite' )
            const { country: new_country } = geoip.lookup( ip ) || {}
            if( new_country ) {
                log.info( `GeoIP lookup for ${ ip } returned ${ new_country }` )
                country = new_country
            }
        } catch ( e ) {
            log.error( `Error looking up country for ip ${ ip }`, e )
        }
    }

    // Get country counts
    const miner_country_count = cache( `miner_country_count` ) || []
    const miner_count = miner_data.length
    const country_count = miner_country_count[ country ] || 0
    const miners_in_same_country = miner_country_count[ country ] || 0

    // Calculate score
    const ip_pct_same_country = Math.round( miners_in_same_country / miner_count  * 100 )

    // Get the connection type
    const is_dc = await is_data_center( ip )

    // Calcluate the score of the request, datacenters get half scores
    const datacenter_penalty = 0.9
    let country_uniqueness_score = ( 100 - ip_pct_same_country ) * ( is_dc ? datacenter_penalty : 1 )
    if( country_count <= 1 ) {
        log.info( `There is only one country in the database, force-setting country uniqueness to 100`  )
        country_uniqueness_score = 100
    }
    log.info( `Country uniqueness: ${ country_uniqueness_score }` )

    // Curve score with a power function where 100 stays 100, but lower numbers get more extreme
    const curve = 5
    const powered_score = Math.pow( country_uniqueness_score / 100, curve ) * 100
    log.info( `Powered score: ${ powered_score }` )

    // Return the score of the request
    return { powered_score, country_uniqueness_score, country, details: {
        is_dc,
        ip_pct_same_country,
        country_count,
        miners_in_same_country
    } }
    
}



/**
 * Scores the uniqueness of a request based on its IP address.
 *
 * @param {Object} request - The request object.
 * @param {string} request.ip - The IP address of the request.
 * @param {string[]} request.ips - The array of IP addresses in  the request.
 * @param {Object} request.connection - The connection object of the request.
 * @param {Object} request.socket - The socket object of the request.
 * @param {Function} request.get - Function to get headers from the request.
 * @param {Object} options - Options for the function.
 * @param {boolean} [options.save_ip=true] - Whether to save the IP address to the database.
 * @returns {Promise<Object|undefined>} - Returns an object containing the uniqueness score and country uniqueness score if successful, otherwise undefined.
 */
export async function score_request_uniqueness( request ) {

    // Get the ip of the originating request
    let { unspoofable_ip, spoofable_ip } = ip_from_req( request )

    // Sanetise potential ipv6 mapping of ipv4 address
    if( unspoofable_ip?.startsWith( '::ffff:' ) ) unspoofable_ip = unspoofable_ip?.replace( '::ffff:', '' )

    // Log out the ip address of the request
    if( unspoofable_ip ) log.info( `Request from ${ unspoofable_ip }` )
    if( !unspoofable_ip ) {
        log.info( `Cannot determine ip address of request, but it might be coming from ${ spoofable_ip } based on headers alone` )
        // return undefined so the calling parent knows there is an issue
        return { uniqueness_score: undefined }
    }

    // Get the score of this ip
    const { powered_score, country_uniqueness_score, country, details } = await score_ip_uniqueness( unspoofable_ip )

    // If country was undefined, exit with undefined score
    if( !country && !CI_MODE ) {
        log.info( `Cannot determine country of request` )
        return { uniqueness_score: undefined }
    }

    // Return the score of the request
    return { uniqueness_score: powered_score, country_uniqueness_score, details }

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