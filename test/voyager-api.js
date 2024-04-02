import assert from 'node:assert'
import { fetchRoundDetails } from '../lib/voyager-api.js'

const recordTelemetry = (measurementName, fn) => { /* no-op */ }

describe('voyager-api client', () => {
  it('fetches round details', async function () {
    this.timeout(10_000)
    const { retrievalTasks, maxTasksPerNode, ...details } = await fetchRoundDetails(
      '0xc524b83bf85021e674a7c9f18f5381179fabaf6c',
      0,
      recordTelemetry
    )

    assert.deepStrictEqual(details, {
      roundId: '1' // BigInt serialized as String
    })

    assert.strictEqual(typeof maxTasksPerNode, 'number')

    assert.strictEqual(retrievalTasks.length, 1000)
    assert.deepStrictEqual(retrievalTasks.slice(0, 2), [
      {
        cid: '/ipfs/QmRYoNskukBNN6LsR92cV4LazUJwwCkqs7tDJAKHfyFtCA/2699,1577'
      },
      {
        cid: '/ipfs/QmeFKv51P8sTCXa2wChuWTdnxnB8Z1UEUnkhyG4CGRih6V/1972,1260'
      }
    ])
  })
})
