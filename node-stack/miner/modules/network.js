import { log } from "mentie"

export function request_is_local( request ) {

    // Get the ip of the originating request
    let { ip: request_ip, ips, connection, socket } = request
    let spoofable_ip = request_ip || ips[0] || request.get( 'x-forwarded-for' )
    let unspoofable_ip = connection.remoteAddress || socket.remoteAddress

    // Log out the ip address of the request
    if( unspoofable_ip ) log.info( `Request from ${ unspoofable_ip }` )
    if( !unspoofable_ip ) {
        log.info( `Cannot determine ip address of request, but it might be coming from ${ spoofable_ip } based on headers alone` )
        // Assume remote when unknown
        return false
    }

    // Check if the ip is local
    const local_ip_patterns_v4_and_v6 = [
        /^127\./,
        /^::1$/,
        /^172\./,
        /^::ffff:127\./,
        /^::ffff:172\./,
    ]
    const is_local = local_ip_patterns_v4_and_v6.some( pattern => pattern.test( unspoofable_ip ) )   
    
    return is_local

}