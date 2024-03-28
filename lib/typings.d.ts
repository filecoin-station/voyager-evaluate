import { Point } from '@influxdata/influxdb-client'

export {
  Point
}


/**
 * Details of a retrieval task as returned by Voyager HTTP API.
 */
export interface RetrievalTask {
  cid: String;
}

/**
 * Details of a Voyager round as returned by Voyager HTTP API.
 */
export interface RoundDetails {
  roundId: string; // BigInt serialized as String (JSON does not support BigInt)
  retrievalTasks: RetrievalTask[];
  maxTasksPerNode: number;
}

export type RecordTelemetryFn = (
  name: string,
  fn: (point: Point) => void
) => void

// When adding a new enum value, remember to update the summary initializer inside `evaluate()`
export type FraudAssesment =
  | 'OK'
  | 'INVALID_TASK'
  | 'DUP_INET_GROUP'
  | 'TOO_MANY_TASKS'

// When adding a new enum value, remember to update the summary initializer inside `reportRetrievalStats()`
export type RetrievalResult =
  | 'OK'
  | 'CAR_TOO_LARGE'
  | 'BAD_GATEWAY'
  | 'GATEWAY_TIMEOUT'
  | 'ERROR_500'
  | 'UNKNOWN_ERROR'

export interface Measurement {
  participantAddress: string;
  fraudAssessment?: FraudAssesment;
  retrievalResult?: RetrievalResult;

  cid: string;
  inet_group: string;

  end_at: number;
  finished_at: number;

  status_code: number | undefined | null;
  car_too_large: boolean;
}

export interface GroupWinningStats {
  min: number;
  max: number;
  mean: number;
}

export interface FraudDetectionStats {
  groupWinning: GroupWinningStats
}
