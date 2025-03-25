import { wait_for_server_up } from "./helpers"
import { describe, test, expect } from 'vitest'
import fetch from 'node-fetch'
import 'dotenv/config'

const { PUBLIC_VALIDATOR_URL='http://localhost:3000' } = process.env


describe(  'Challenge', () => {

    test( 'Solves provided challenges', { timeout: 60_000 }, async () => {

        // Wait for sever to be up
        console.log( 'Waiting for server to be up' )
        await wait_for_server_up()
        console.log( 'Server is up' )

        // Grab a challenge from localhost:3000/challenge/new
        console.log( `Fetching challenge from ${ PUBLIC_VALIDATOR_URL }/challenge/new` )
        const challenge_res = await fetch( `${ PUBLIC_VALIDATOR_URL }/challenge/new` )
        let { challenge_url } = await challenge_res.json()
        console.log( `Challenge url: ${ challenge_url }` )

        // Reformat internal challenge url to point to docker container as the miner container sees it (if we are running on localhost)
        challenge_url = challenge_url.replace( `localhost`, 'validator' )

        // Post the challenge url to localhost:3001/challenge in url json key
        console.log( `Posting challenge to http://localhost:3001/challenge` )
        const solution_response = await fetch( 'http://localhost:3001/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { url: challenge_url } )
        } )
        console.log( `Solution response:`, solution_response.status )
        const score = await solution_response.json()
        console.log( `Score:`, JSON.stringify( score, null, 2 ) )

        // Require properties speed_score, uniqueness_score
        expect( score ).toHaveProperty( 'speed_score' )
        expect( score ).toHaveProperty( 'uniqueness_score' )

    } )

} )
