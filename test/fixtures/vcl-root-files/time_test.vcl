sub vcl_recv {
  # Test time.add function
  declare local var.current_time TIME;
  declare local var.future_time TIME;
  declare local var.past_time TIME;
  
  # Get the current time
  set var.current_time = std.time.now();
  
  # Add 1 hour to the current time
  set var.future_time = std.time.add(var.current_time, "1h");
  
  # Subtract 1 hour from the current time
  set var.past_time = std.time.add(var.current_time, "-1h");
  
  # Log the times
  log "Current time: " + std.strftime("%Y-%m-%d %H:%M:%S", var.current_time);
  log "Future time (1h ahead): " + std.strftime("%Y-%m-%d %H:%M:%S", var.future_time);
  log "Past time (1h ago): " + std.strftime("%Y-%m-%d %H:%M:%S", var.past_time);
  
  # Test time.sub function
  declare local var.time_diff RTIME;
  
  # Calculate the difference between future and current time
  set var.time_diff = std.time.sub(var.future_time, var.current_time);
  
  # Log the difference
  log "Time difference (future - current): " + var.time_diff + " milliseconds";
  
  # Test time.is_after function
  declare local var.is_future_after_current BOOL;
  declare local var.is_past_after_current BOOL;
  
  # Check if future time is after current time
  set var.is_future_after_current = std.time.is_after(var.future_time, var.current_time);
  
  # Check if past time is after current time
  set var.is_past_after_current = std.time.is_after(var.past_time, var.current_time);
  
  # Log the results
  log "Is future time after current time? " + if(var.is_future_after_current, "Yes", "No");
  log "Is past time after current time? " + if(var.is_past_after_current, "Yes", "No");
  
  # Test time.hex_to_time function
  declare local var.hex_time STRING;
  declare local var.converted_time TIME;
  
  # Set a hexadecimal time value (example: 0x5F7D7E98 = 1602086552 = 2020-10-07 14:29:12 UTC)
  set var.hex_time = "5F7D7E98";
  
  # Convert hex to time
  set var.converted_time = std.time.hex_to_time(var.hex_time);
  
  # Log the result
  log "Hex time: " + var.hex_time;
  log "Converted time: " + std.strftime("%Y-%m-%d %H:%M:%S", var.converted_time);
  
  # Add a header to show the test results
  set req.http.X-Time-Test = "Time functions test completed";
  
  return(pass);
}
