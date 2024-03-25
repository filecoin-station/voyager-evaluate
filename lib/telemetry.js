import { InfluxDB, Point } from '@influxdata/influxdb-client'

const influx = new InfluxDB({
  url: 'https://eu-central-1-1.aws.cloud2.influxdata.com',
  // voyager-evaluate-write
  token: 'YSYZcPE64VfLYh0qq7fNlxqyrxfiKCLxaxuUM-rIbBLS9uwiItKBeeSQXnCvbRqDcSxvstCEQF__ZgAliDBE3A=='
})
const writeClient = influx.getWriteApi(
  'Filecoin Station', // org
  'voyager-evaluate', // bucket
  'ns' // precision
)

setInterval(() => {
  writeClient.flush().catch(console.error)
}, 10_000).unref()

export const recordTelemetry = (name, fn) => {
  const point = new Point(name)
  fn(point)
  writeClient.writePoint(point)
  console.log('TELEMETRY %s %o', name, point)
}

export const close = () => writeClient.close()

export {
  Point
}
