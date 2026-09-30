# History Widget

Client: Migration \
Partner: Peter

## Dynamic picklist ordering

Active records in `Widget_Picklist_Config` are sorted by numeric `Sort_Order`, lowest first, for History Type, History Result, Regarding, and Duration. The number is a priority, not a dropdown position: Fruit at 9 appears after Other at 5 and before Meeting at 10. Zero is a valid priority. Blank or invalid priorities appear after all numeric priorities; equal priorities keep their returned order. Reload the widget after changing configuration because successful reads are cached for the current widget session.

Matter History Regarding options use the selected Activity Type's mapping first, then the Category (History Type) mapping if the activity has no mapping, then `_default`. This lets a Regarding row with `Parent_Type = Fruit` appear when the Category is Fruit, even if the selected Activity Type is Apple. An explicitly empty Activity Type mapping remains empty.

## Matter History picklist permissions

The widget reads the `Applications` layout to show Current Stage and Matter Progress options. If the layout response does not include an explicit dependency map for every available stage, it reads Zoho CRM's [Get Mapped Dependency Fields API](https://www.zoho.com/crm/developer/docs/api/v8/get-map-dependency.html). The widget connection named `zoho_crm_conn` should have `ZohoCRM.settings.map_dependency.READ` (or `ZohoCRM.settings.map_dependency.ALL`) so live CRM rules remain authoritative. If that scope is unavailable, the widget uses the approved eight-stage fallback map and never exposes the full Matter Progress list for a single stage.
