export const dispatchLabel = status => ({
  assigned: 'Units assigned',
  partially_assigned: 'Partial assignment',
  awaiting_location: 'Location needs confirmation',
  pending_callback: 'Location needs confirmation',
  review_required: 'Operator review needed',
  merged_duplicate: 'Linked to an existing report',
  resource_unavailable: 'No matching units available',
  outside_service_area: 'Outside the simulation fleet area',
  not_required: 'Dispatch not required',
}[status] || 'Pending review');
