# Booking locations

Booking checkout uses cascading province, city/municipality, and barangay dropdowns from the [PSGC API](https://psgc.gitlab.io/api/). Metro Manila appears in the province selector and loads its cities from the NCR region endpoint. Changing a location clears dependent selections and the specific address. Failed requests offer retry and manual entry.

The street, building, house, or unit address remains editable. The Google Maps search link includes the selected area and works without an API key.

## Google Maps address suggestions

1. Enable Maps JavaScript API and Places API (New) in your Google Cloud project.
2. Set `VITE_GOOGLE_MAPS_API_KEY` in your local environment and frontend hosting environment, then restart the development server or rebuild.
3. Restrict this browser key to your app's HTTP referrers and the two APIs.

The integration uses the [Place Autocomplete Data API](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data), requests Philippine results, and appends the selected area to the search text. It waits for three address characters and debounces requests. Suggestions support arrow keys, Enter, Escape, and pointer selection. Selecting a result fetches its formatted address and starts a fresh session token for the next search.

Suggestions provide address assistance; users should confirm their barangay and include their house or unit number. The dropdown values remain authoritative for the booking's selected area. Suggestions are optional: missing configuration, failed requests, and no matches allow manual address entry. The SDK loads only when address suggestions are needed. No schema or checkout payload changes are required.
