import createDebug from 'debug'
import getValueAtPercentile from 'just-percentile'

const debug = createDebug('voyager:retrieval-stats')

export {
  getValueAtPercentile
}

/**
 * @param {import('./typings').Measurement[]} measurements
 * @param {import('./typings').Point} telemetryPoint
 */
export const buildRetrievalStats = (measurements, telemetryPoint) => {
  const totalCount = measurements.length
  if (totalCount < 1) {
    telemetryPoint.intField('measurements', 0)
    telemetryPoint.intField('unique_tasks', 0)
    return
  }

  const uniqueTasksCount = countUniqueTasks(measurements)

  // Calculate aggregates per retrieval result

  // We are intentionally not initializing all possible keys here.
  // Example of omitted keys: UNDEFINED, ERROR_500 and ERROR_404.
  // The idea is that if we don't explicitly initialise them here and there is no measurement with
  // such retrieval result, then the Grafana dashboard will not show these results at all.
  /** @type {Record<import('./typings').RetrievalResult, number> */
  const resultBreakdown = {
    OK: 0,
    CAR_TOO_LARGE: 0,
    BAD_GATEWAY: 0,
    GATEWAY_TIMEOUT: 0
  }

  const participants = new Set()
  const inetGroups = new Set()
  const tasksPerNode = new Map()

  for (const m of measurements) {
    // `retrievalResult` should be always set by lib/preprocess.js, so we should never encounter
    // `UNDEFINED` result. However, I am still handling that edge case for extra robustness.
    updateBreakdown(resultBreakdown, m.retrievalResult ?? 'UNDEFINED')

    participants.add(m.participantAddress)
    inetGroups.add(m.inet_group)

    debug('status=%s valid? %s', m.status_code, m.fraudAssessment === 'OK')

    const node = `${m.inet_group}::${m.participantAddress}`
    tasksPerNode.set(node, (tasksPerNode.get(node) ?? 0) + 1)
  }
  const successRate = resultBreakdown.OK / totalCount

  telemetryPoint.intField('unique_tasks', uniqueTasksCount)
  telemetryPoint.floatField('success_rate', successRate)
  telemetryPoint.intField('participants', participants.size)
  telemetryPoint.intField('inet_groups', inetGroups.size)
  telemetryPoint.intField('measurements', totalCount)

  addHistogramToPoint(
    telemetryPoint,
    Array.from(tasksPerNode.values()),
    'tasks_per_node_'
  )

  for (const [result, count] of Object.entries(resultBreakdown)) {
    telemetryPoint.floatField(`result_rate_${result}`, count / totalCount)
  }
}

/**
 * @param {{[key: string]: number}} breakdown
 * @param {string} key */
const updateBreakdown = (breakdown, result) => {
  const oldCount = breakdown[result] ?? 0
  breakdown[result] = oldCount + 1
}

/**
 *
 * @param {import('./typings').Point} point
 * @param {string} fieldNamePrefix
 * @param {number[]} values
 */
const addHistogramToPoint = (point, values, fieldNamePrefix = '') => {
  const count = values.length
  if (count < 1) return
  values.sort((a, b) => a - b)
  point.intField(`${fieldNamePrefix}min`, values[0])
  point.intField(`${fieldNamePrefix}mean`, values.reduce((sum, v) => sum + BigInt(v), 0n) / BigInt(count))
  point.intField(`${fieldNamePrefix}max`, values[count - 1])
  for (const p of [1, 5, 10, 50, 90, 95, 99]) {
    point.intField(`${fieldNamePrefix}p${p}`, getValueAtPercentile(values, p / 100))
  }
}

// TODO: include Filecoin Deal id
export const getTaskId = (/** @type {import('./typings').Measurement} */m) => `${m.cid}`

/**
 * @param {import('./typings').Measurement[]} measurements
 * @returns {number}
 */
const countUniqueTasks = (measurements) => {
  const uniqueTasks = new Set()
  for (const m of measurements) {
    const id = getTaskId(m)
    uniqueTasks.add(id)
  }

  return uniqueTasks.size
}

/**
 * @param {import('./typings').Measurement[]} measurements
 * @param {import('./typings').Point} telemetryPoint
 */
export const recordCommitteeSizes = (measurements, point) => {
  /** @type {Map<string, {
   * subnets: Set<string>;
   * participants: Set<string>;
   * nodes: Set<string>;
   * measurements: number
   * }>} */
  const tasks = new Map()
  for (const m of measurements) {
    const key = getTaskId(m)
    let data = tasks.get(key)
    if (!data) {
      data = {
        subnets: new Set(),
        participants: new Set(),
        nodes: new Set(),
        measurements: 0
      }
      tasks.set(key, data)
    }
    data.subnets.add(m.inet_group)
    data.participants.add(m.participantAddress)
    // We don't have Station instance identifier in the measurement.
    // The pair (inet_group, participant_address) is a good approximation.
    data.nodes.add(`${m.inet_group}::${m.participantAddress}`)
    data.measurements++
  }

  /** @type {Array<number>} */
  const subnetCounts = []
  /** @type {Array<number>} */
  const participantCounts = []
  /** @type {Array<number>} */
  const nodeCounts = []
  /** @type {Array<number>} */
  const measurementCounts = []
  for (const { subnets, participants, nodes, measurements } of tasks.values()) {
    subnetCounts.push(subnets.size)
    participantCounts.push(participants.size)
    nodeCounts.push(nodes.size)
    measurementCounts.push(measurements)
  }

  addHistogramToPoint(point, subnetCounts, 'subnets_')
  addHistogramToPoint(point, participantCounts, 'participants_')
  addHistogramToPoint(point, nodeCounts, 'nodes_')
  addHistogramToPoint(point, measurementCounts, 'measurements_')
}
