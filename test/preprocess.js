import { getRetrievalResult, parseParticipantAddress, preprocess, Measurement, parseMeasurements } from '../lib/preprocess.js'
import { Point } from '../lib/telemetry.js'
import assert from 'node:assert'
import createDebug from 'debug'
import { RoundData } from '../lib/round.js'

const debug = createDebug('test')

const telemetry = []
const recordTelemetry = (measurementName, fn) => {
  const point = new Point(measurementName)
  fn(point)
  debug('recordTelemetry(%s): %o', measurementName, point.fields)
  telemetry.push(point)
}
beforeEach(() => telemetry.splice(0))

describe('preprocess', () => {
  it('fetches measurements', async () => {
    const round = new RoundData(0)
    const cid = 'bafybeif2'
    const roundIndex = 0
    const measurements = [{
      participant_address: 'f410ftgmzttyqi3ti4nxbvixa4byql3o5d4eo3jtc43i',
      inet_group: 'ig1',
      finished_at: '2023-11-01T09:00:00.000Z',
      end_at: '2023-11-01T09:00:03.000Z'
    }]
    const getCalls = []
    const fetchMeasurements = async (cid) => {
      getCalls.push(cid)
      return measurements
    }
    const logger = { log: debug, error: console.error }
    await preprocess({ round, cid, roundIndex, fetchMeasurements, recordTelemetry, logger })

    assert.deepStrictEqual(round.measurements, [
      new Measurement({
        participant_address: '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E',
        inet_group: 'ig1',
        finished_at: '2023-11-01T09:00:00.000Z',
        end_at: '2023-11-01T09:00:03.000Z',
        retrievalResult: 'UNKNOWN_ERROR'
      })
    ])
    assert.deepStrictEqual(getCalls, [cid])
  })

  it('accepts ETH 0x address', () => {
    const converted = parseParticipantAddress('0x3356fd7D01F001f5FdA3dc032e8bA14E54C2a1a1')
    assert.strictEqual(converted, '0x3356fd7D01F001f5FdA3dc032e8bA14E54C2a1a1')
  })
})

describe('parseMeasurements', () => {
  const measurements = [{ foo: 'bar' }, { beep: 'boop' }]
  it('parses NDJSON', () => {
    assert.deepStrictEqual(
      parseMeasurements(measurements.map(m => JSON.stringify(m)).join('\n')),
      measurements
    )
  })
})

describe('getRetrievalResult', () => {
  /** @type {import('../lib/typings').Measurement} */
  const SUCCESSFUL_RETRIEVAL = {
    id: 11009569,
    zinnia_version: '0.14.0',
    participant_address: 'f410fgkhpcrbmdvic52o3nivftrjxr7nzw47updmuzra',
    timeout: false,
    status_code: 200,
    end_at: '1970-01-01T00:00:00.000Z',
    inet_group: 'ue49TX_JdYjI',
    cid: 'bafkreihstuf2qcu3hs64ersidh46cjtilxcoipmzgu3pifwzmkqdjpraqq'
  }

  it('successful retrieval', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL
    })
    assert.strictEqual(result, 'OK')
  })

  it('TIMEOUT', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL,
      timeout: true
    })
    assert.strictEqual(result, 'TIMEOUT')
  })

  it('BAD_GATEWAY', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL,
      status_code: 502
    })
    assert.strictEqual(result, 'BAD_GATEWAY')
  })

  it('GATEWAY_TIMEOUT', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL,
      status_code: 504
    })
    assert.strictEqual(result, 'GATEWAY_TIMEOUT')
  })

  it('SERVER_ERROR - 500', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL,
      status_code: 500
    })
    assert.strictEqual(result, 'ERROR_500')
  })

  it('SERVER_ERROR - 503', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL,
      status_code: 503
    })
    assert.strictEqual(result, 'ERROR_503')
  })

  it('UNKNOWN_ERROR - missing end_at', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL,
      end_at: undefined
    })
    assert.strictEqual(result, 'UNKNOWN_ERROR')
  })

  it('UNKNOWN_ERROR - status_code is null', () => {
    const result = getRetrievalResult({
      ...SUCCESSFUL_RETRIEVAL,
      timeout: false,
      status_code: null
    })
    assert.strictEqual(result, 'UNKNOWN_ERROR')
  })
})
