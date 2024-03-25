import assert from 'node:assert'

/**
 * @returns {import('../../lib/telemetry').Point}
 */
export const assertRecordedTelemetryPoint = (recordings, name) => {
  const point = recordings.find(p => p.name === name)
  assert(!!point,
    `No telemetry point "${name}" was recorded. Actual points: ${JSON.stringify(recordings.map(p => p.name))}`)
  return point
}

export const assertPointFieldValue = (point, fieldName, expectedValue) => {
  const actualValue = point.fields[fieldName]
  assert.strictEqual(
    actualValue,
    expectedValue,
   `Expected ${point.name}.fields.${fieldName} to equal ${expectedValue} but found ${actualValue}`
  )
}
