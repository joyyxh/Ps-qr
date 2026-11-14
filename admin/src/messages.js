// Plain-language text for each committed rejection code that 0016 returns, plus 'forbidden'.
// tests/messages.test.js reads the migration and fails if a code is missing here.

export const REJECTION_MESSAGES = Object.freeze({
  backdate_not_confirmed: 'This start date is in the past. Tick the backdating confirmation to continue, or change the start.',
  backdate_window_exceeded: 'The start date is further in the past than the backdating window allows.',
  coverage_already_revoked: 'This coverage has already been revoked.',
  coverage_not_found: 'No coverage with that ID exists for this shop.',
  custom_range_invalid: 'The start and end dates do not form a valid custom range.',
  end_not_allowed: 'This licence type does not take an end date.',
  end_required: 'This licence type needs an end date.',
  extend_blocked_by_lifetime: 'A lifetime licence exists for this shop, so it cannot be extended.',
  future_start_not_allowed: 'One calendar month and one calendar year licences cannot start in the future.',
  forbidden: 'You are not authorised for this action, or your sign-in does not meet the required level. Nothing was changed.',
  invalid_extension_unit: 'Choose one calendar month or one calendar year.',
  invalid_grant_kind: 'Choose a valid licence type.',
  invalid_reason: 'The reason is missing or too long.',
  invalid_request: 'The request is incomplete or malformed. Check the fields and try again.',
  invalid_timestamp: 'A start or end date could not be read. Check its format.',
  natural_end_passed: 'This coverage has already reached its natural end, so it cannot be revoked.',
  not_confirmed: 'Tick the confirmation box to continue.',
  overlap: 'This period overlaps an existing licence of the same type.',
  request_conflict: 'This request ID was already used for a different request. Start the action again.',
  shop_not_found: 'No shop matches that ID.',
  stale_state_version: 'The shop changed after it was loaded, so nothing was changed. Its licence view is reloaded. Check it, then review the change again.',
  start_required: 'This licence type needs a start date.',
  unknown_field: 'The request contains a field this action does not accept.',
});

export const GENERIC_REJECTION = 'The server rejected this request. Nothing was changed.';

export function rejectionMessage(code) {
  return Object.prototype.hasOwnProperty.call(REJECTION_MESSAGES, code)
    ? REJECTION_MESSAGES[code]
    : GENERIC_REJECTION;
}
