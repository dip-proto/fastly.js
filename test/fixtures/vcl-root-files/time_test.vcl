sub vcl_recv {
  # Test time.add / time.sub
  declare local var.current_time TIME;
  declare local var.future_time TIME;
  declare local var.past_time TIME;

  set var.current_time = now;
  set var.future_time = time.add(var.current_time, 1h);
  set var.past_time = time.sub(var.current_time, 1h);

  log "Current time: " + strftime({"%Y-%m-%d %H:%M:%S"}, var.current_time);
  log "Future time (1h ahead): " + strftime({"%Y-%m-%d %H:%M:%S"}, var.future_time);
  log "Past time (1h ago): " + strftime({"%Y-%m-%d %H:%M:%S"}, var.past_time);

  # Test time.is_after
  declare local var.is_future_after_current BOOL;
  declare local var.is_past_after_current BOOL;

  set var.is_future_after_current = time.is_after(var.future_time, var.current_time);
  set var.is_past_after_current = time.is_after(var.past_time, var.current_time);

  log "Is future time after current time? " + if(var.is_future_after_current, "Yes", "No");
  log "Is past time after current time? " + if(var.is_past_after_current, "Yes", "No");

  # Test time.hex_to_time (0x5F7D7E98 = 2020-10-07 UTC)
  declare local var.converted_time TIME;
  set var.converted_time = time.hex_to_time(1, "5F7D7E98");

  log "Converted time: " + strftime({"%Y-%m-%d %H:%M:%S"}, var.converted_time);

  set req.http.X-Time-Test = "Time functions test completed";

  return(pass);
}
