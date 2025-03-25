import { exec } from 'child_process'
import { log } from 'mentie'

/**
 * Executes a shell command and returns a promise that resolves with the command's output.
 *
 * @param {string} command - The shell command to execute.
 * @param {boolean} [silent=false] - If true, suppresses logging of the command and its output.
 * @param {boolean} [verbose=false] - If true, logs detailed error information.
 * @returns {Promise<{error: Error|null, stdout: string, stderr: string}>} - A promise that resolves with an object containing error, stdout, and stderr.
 */
export async function run( command, silent=false, verbose=false ) {

    return new Promise( ( resolve ) => {

        if( !silent ) log.info( `exec:`, command )
        exec( command, ( error, stdout, stderr ) => {

            if( !stderr?.length ) stderr = null
            if( !stdout?.length ) stdout = null

            // If silent, just resolve with data
            if( silent ) return resolve( { error, stdout, stderr } )
            
            // If verbose, log all
            if( verbose ) log.info( { error, stdout, stderr } )

            // Log the output
            if( stdout ) log.info( `stdout:`, stdout.trim?.() || stdout )
            if( stderr ) log.warn( `stderr:`, stderr.trim?.() || stderr )
            if( error && verbose ) log.warn( `error:`, error.trim?.() || error )
            if( error ) log.info( `Error running ${ command }:` )


            // Resolve with data
            resolve( { error, stdout, stderr } )

        } )

    } )

}