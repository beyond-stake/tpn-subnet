import { describe, test, expect } from 'vitest'
import fetch from 'node-fetch'
import { wait_for_server_up } from './helpers.js'

describe( 'GET /challenge/new', () => {

    // Challenge url
    let challenge_url = ''

    test( 'Returns valid json with expected properties', async () => {

        // Wait for the server to start
        await wait_for_server_up()
        
        // Make GET request
        const response = await fetch( 'http://localhost:3000/challenge/new' )

        // Check if request was successful
        expect( response.ok ).toBe( true )

        // Ensure content type is JSON
        expect( response.headers.get( 'content-type' ) ).toContain( 'application/json' )

        // Parse body as JSON
        const data = await response.json()

        // Log out the data
        console.log( `Challenge data:`, data )

        // Validate you received an object
        expect( data ).toBeInstanceOf( Object )

        // Expect properties challenge and challenge_url
        expect( data ).toHaveProperty( 'challenge' )
        expect( data ).toHaveProperty( 'challenge_url' )

        // Save the challenge url
        challenge_url = data.challenge_url

    } )


    test( 'Can solve challenges', async () => {

        // Wait for the server to start
        await wait_for_server_up()

        // Replace the challenge host with localhost
        const { CI_VALIDATOR_HOST='localhost' } = process.env
        challenge_url = challenge_url.replace( 'validator', CI_VALIDATOR_HOST )

        // Make GET request to get challenge endpoint
        console.log( `Getting challenge at:`, challenge_url )
        const res = await fetch( challenge_url ).then( res => res.json() )
        console.log( `Challenge data:`, res )
        const { response } = res

        // Expect the response to be a uuidv4
        expect( response ).toMatch( /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ )

        // Solve the challenge by making a GET request to the challenge with the response
        const solution_url = `${ challenge_url }/${ response }`
        console.log( `Solving challenge at:`, solution_url )
        const data = await fetch( solution_url ).then( res => res.json() )
        const { correct, score, speed_score, uniqueness_score, solved_at } = data

        // Expect the response to be correct
        expect( correct ).toBe( true )
        expect( typeof score ).toBe( 'number' )
        expect( typeof speed_score ).toBe( 'number' )
        expect( typeof uniqueness_score ).toBe( 'number' )
        expect( typeof solved_at ).toBe( 'number' )



    } )

} )
