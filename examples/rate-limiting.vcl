/**
 * Rate Limiting Example
 *
 * This VCL file demonstrates how to use the rate limiting functions to:
 * 1. Create rate counter windows
 * 2. Increment rate counters
 * 3. Check rate limits
 * 4. Use penalty boxes
 */

sub vcl_recv {
  # Open a rate counter window with a 60-second duration
  set req.http.X-Window-ID = std.ratelimit.open_window(60);
  
  # Increment a counter for this client IP
  set req.http.X-Counter = std.ratelimit.ratecounter_increment(client.ip, 1);
  
  # Check if the client has exceeded 10 requests per 5 seconds
  if (std.ratelimit.check_rates(client.ip, "10:5,100:60,1000:3600")) {
    # Add the client to a penalty box for 60 seconds
    std.ratelimit.penaltybox_add("rate_violators", client.ip, 60);
    error 429 "Too Many Requests";
  }
  
  # Check if the client is in the penalty box
  if (std.ratelimit.penaltybox_has("rate_violators", client.ip)) {
    error 429 "Too Many Requests";
  }
  
  # Log the remaining tokens for this client
  set req.http.X-Tokens = std.ratelimit.ratecounter_increment(client.ip, 0);
  
  return(lookup);
}

sub vcl_error {
  # Custom error page for rate limiting
  if (obj.status == 429) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    set obj.http.Retry-After = "60";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rate Limit Exceeded</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #c00;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 5px;
              background-color: #f9f9f9;
            }
            .info {
              background-color: #e9f7fe;
              border-left: 4px solid #2196F3;
              padding: 10px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Rate Limit Exceeded</h1>
            <div class="info">
              <p>You have made too many requests. Please try again in 60 seconds.</p>
              <p>Our rate limits help ensure fair usage of our services for all users.</p>
            </div>
            <p>If you believe this is an error, please contact support.</p>
          </div>
        </body>
      </html>
    "};
    return(deliver);
  }
  
  return(deliver);
}

sub vcl_deliver {
  # Add rate limit headers to the response
  set resp.http.X-RateLimit-Limit = "10";
  set resp.http.X-RateLimit-Remaining = req.http.X-Tokens;
  set resp.http.X-RateLimit-Reset = "60";
  
  # Remove internal headers
  unset resp.http.X-Window-ID;
  unset resp.http.X-Counter;
  
  return(deliver);
}
