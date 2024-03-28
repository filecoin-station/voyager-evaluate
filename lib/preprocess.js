import assert from 'node:assert'
import { ethers } from 'ethers'
import { ethAddressFromDelegated } from '@glif/filecoin-address'
import { CarReader } from '@ipld/car'
import { validateBlock } from '@web3-storage/car-block-validator'
import { recursive as exporter } from 'ipfs-unixfs-exporter'
import createDebug from 'debug'
import pRetry from 'p-retry'

const debug = createDebug('voyager:preprocess')

export class Measurement {
  constructor (m, pointerize = (v) => v) {
    this.participantAddress = pointerize(parseParticipantAddress(m.participant_address))
    this.cid = pointerize(m.cid)
    this.fraudAssessment = null
    this.inet_group = pointerize(m.inet_group)
    this.status_code = m.status_code
    this.finished_at = parseDateTime(m.finished_at)
  }
}

const parseDateTime = (str) => {
  if (!str) return undefined
  const value = new Date(str)
  if (Number.isNaN(value.getTime())) return undefined
  return value.getTime()
}

export const preprocess = async ({
  round,
  cid,
  roundIndex,
  fetchMeasurements,
  recordTelemetry,
  logger
}) => {
  const start = new Date()
  /** @type import('./typings').Measurement[] */
  const measurements = await pRetry(
    () => fetchMeasurements(cid),
    {
      retries: 10,
      onFailedAttempt: err => {
        console.error(err)
        console.error(`Retrying ${cid} ${err.retriesLeft} more times`)
      }
    }
  )
  const fetchDuration = new Date() - start
  const validMeasurements = measurements
    .map(measurement => {
      try {
        return new Measurement(measurement, round.pointerize)
      } catch (err) {
        logger.error('Invalid measurement:', err.message, measurement)
        return null
      }
    })
    .filter(measurement => {
      if (measurement === null) return false

      // Print round & participant address & CID together to simplify lookup when debugging
      // Omit the `m` object from the format string to get nicer formatting
      debug(
        'RETRIEVAL RESULT for round=%s client=%s cid=%s: %s',
        roundIndex,
        measurement.participantAddress,
        measurement.cid,
        measurement.retrievalResult,
        measurement)

      try {
        assertValidMeasurement(measurement)
        return true
      } catch (err) {
        logger.error('Invalid measurement:', err.message, measurement)
        return false
      }
    })
  logger.log(
    'PREPROCESS ROUND %s: Added measurements from CID %s\n%o',
    roundIndex,
    cid,
    { total: measurements.length, valid: validMeasurements.length }
  )

  const okCount = validMeasurements.reduce((c, m) => m.retrievalResult === 'OK' ? c + 1 : c, 0)
  const total = validMeasurements.length
  logger.log('Retrieval Success Rate: %s%s (%s of %s)', Math.round(100 * okCount / total), '%', okCount, total)

  round.measurements.push(...validMeasurements)

  recordTelemetry('preprocess', point => {
    point.intField('round_index', roundIndex)
    point.intField('total_measurements', measurements.length)
    point.intField('valid_measurements', validMeasurements.length)
    point.intField('fetch_duration_ms', fetchDuration)
  })

  return validMeasurements
}

export const fetchMeasurements = async cid => {
  const res = await fetch(
    `https://${encodeURIComponent(cid)}.ipfs.w3s.link?format=car`
  )
  if (!res.ok) {
    const msg = `Cannot fetch measurements ${cid}: ${res.status}\n${await res.text()}`
    throw new Error(msg)
  }
  const reader = await CarReader.fromIterable(res.body)
  const entries = exporter(cid, {
    async get (blockCid) {
      const block = await reader.get(blockCid)
      try {
        await validateBlock(block)
      } catch (err) {
        throw new Error(
          `Invalid block ${blockCid} of root ${cid}`, { cause: err }
        )
      }
      return block.bytes
    }
  })
  for await (const entry of entries) {
    // Depending on size, entries might be packaged as `file` or `raw`
    // https://github.com/web3-storage/w3up/blob/e8bffe2ee0d3a59a977d2c4b7efe425699424e19/packages/upload-client/src/unixfs.js#L11
    if (entry.type === 'file' || entry.type === 'raw') {
      const bufs = []
      for await (const buf of entry.content()) {
        bufs.push(buf)
      }
      return parseMeasurements(Buffer.concat(bufs).toString())
    }
  }
  throw new Error('No measurements found')
}

export const parseMeasurements = str => {
  return str.split('\n').filter(Boolean).map(line => JSON.parse(line))
}

export const parseParticipantAddress = filWalletAddress => {
  // ETH addresses don't need any conversion
  if (filWalletAddress.startsWith('0x')) {
    return filWalletAddress
  }

  try {
    return ethAddressFromDelegated(filWalletAddress)
  } catch (err) {
    err.message = `Invalid participant address ${filWalletAddress}: ${err.message}`
    err.filWalletAddress = filWalletAddress
    throw err
  }
}

const assertValidMeasurement = measurement => {
  assert(
    typeof measurement === 'object' && measurement !== null,
    'object required'
  )
  assert(ethers.isAddress(measurement.participantAddress), 'valid participant address required')
  assert(typeof measurement.inet_group === 'string', 'valid inet group required')
}

/**
 * @param {import('./typings').Measurement} measurement
 * @return {import('./typings').RetrievalResult}
 */
export const getRetrievalResult = measurement => {
  if (measurement.car_too_large) return 'CAR_TOO_LARGE'
  switch (measurement.status_code) {
    case 502: return 'BAD_GATEWAY'
    case 504: return 'GATEWAY_TIMEOUT'
  }
  if (measurement.status_code >= 300) return `ERROR_${measurement.status_code}`

  const ok = measurement.status_code >= 200 && typeof measurement.end_at === 'string'

  return ok ? 'OK' : 'UNKNOWN_ERROR'
}
