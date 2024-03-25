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
        cid: '/ipfs/QmWT2u6UEeXJs5MWcSTQhHFyYC9wKevQNjXC4J3k67ymtQ/318.json,7779'
      },
      {
        cid: '/ipfs/QmSyQVF28YytFN848yXG69PqJ9u7F2FgTLpmyKsANdvd5s?key=a528ff1fe27c009e970caab8a346de4e&redirect=https%3A%2F%2Fwww.amazon.com%2F&format=car,2338'
      }
    ])
  })
})
