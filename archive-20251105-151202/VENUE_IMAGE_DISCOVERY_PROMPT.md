# VENUE IMAGE DISCOVERY & LOCAL STORAGE TASK

## Objective
Find real photographs of Southeast Texas venues and store them locally for reliable, permanent display on the SETX Events website.

## Requirements

### Image Discovery
1. For each venue, search for a real, high-quality photograph
2. Check multiple sources:
   - Official venue website (most reliable)
   - Google Images (filter for actual venue photos)
   - TripAdvisor, Yelp (business photos)
   - Wikipedia/Wikimedia Commons (if available)
   - Facebook business page
3. Return ONLY direct image URLs (HTTP/HTTPS)
4. Verify URLs are accessible and will return actual image data

### Image Download & Storage
1. Download each image file to `/home/sauly/setx-events/public/images/venues/`
2. Filename format: `venue-{venue_id}.jpg`
3. Minimum file size: 5KB (to ensure valid images)
4. Handle redirects (HTTP 301, 302)
5. Timeout: 10 seconds per download
6. Skip if download fails (don't block other venues)

### Database Update
1. For successfully downloaded images, update venues table:
   - `cover_image_url = '/images/venues/venue-{id}.jpg'`
   - `logo_url = '/images/venues/venue-{id}.jpg'`
2. Keep existing URLs for venues that couldn't be found
3. Transaction safety: Update only after file is successfully saved

## Execution
- Process venues in priority order (highest priority first)
- Run downloads in parallel (max 3 concurrent)
- Rate limit API calls to 1 per second
- Log progress: venue name, success/failure, file size

## Success Criteria
- 80%+ of venues have downloadable images
- All downloaded images are stored locally
- Database references local paths only (/images/venues/...)
- Images remain accessible even if external sources go down

## Error Handling
- Network timeout: Skip venue, continue with next
- Invalid image URL: Try next source, mark as failed
- Download fails: Don't update database, proceed to next venue
- Storage full: Log error, stop gracefully

## Final Verification
1. Check `/home/sauly/setx-events/public/images/venues/` directory
2. Verify file count matches successful updates
3. Restart API server to reload venue data
4. Test venue page to confirm images display

## Future Runs
This task should be executed:
- During new venue discovery (with each batch)
- Monthly refresh to find missing venue photos
- When venue is added manually to database

Use this prompt for the cloud agent each time venue images need to be discovered and stored locally.
