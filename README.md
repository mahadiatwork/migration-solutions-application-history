# History Widget

Client: Migration \
Partner: Peter

## Matter History picklist permissions

The widget reads the `Applications` layout to show Current Stage and Matter Progress options. If the layout response does not include an explicit dependency map for every available stage, it reads Zoho CRM's [Get Mapped Dependency Fields API](https://www.zoho.com/crm/developer/docs/api/v8/get-map-dependency.html). The widget connection named `zoho_crm_conn` should have `ZohoCRM.settings.map_dependency.READ` (or `ZohoCRM.settings.map_dependency.ALL`) so live CRM rules remain authoritative. If that scope is unavailable, the widget uses the approved eight-stage fallback map and never exposes the full Matter Progress list for a single stage.
