# Documentation

## **Quickstart**  /  [API Reference](https://docs.football-data.org/)

### Overview


On May 20, 2022 I released v4 for public use. I revised the entire reference documentation that you
[find here](https://docs.football-data.org/).



While v2 will remain available until further notice, I encourage you to migrate to v4. It's really worth it.

### Available resources

See all available endpoints underneath. See Filtering table at the very bottom to see how to pass filters in an adequate format.
You can also get an overview by running all available calls through [Postman](https://www.getpostman.com/) by
[importing this collection](https://www.getpostman.com/collections/f3449621c47b66b53725) after download.


| (Sub)Resource | Action | URI | Filters | Sample |
| :-- | :-- | :-- | :-- | --- |
| Area | List one particular area. | /v4/areas/{id} | - | [Open](https://www.football-data.org/documentation/quickstart) |
| Areas | List all available areas. | [/v4/areas/](http://api.football-data.org/v4/areas) | - | [Open](https://www.football-data.org/documentation/quickstart) |
| Competition | List one particular competition. | /v4/competitions/PL | - | [Open](https://www.football-data.org/documentation/quickstart) |
| Competition | List all available competitions. | [/v4/competitions/](http://api.football-data.org/v4/competitions) | areas={AREAS} | [Open](https://www.football-data.org/documentation/quickstart) |
| Competition / Standings | Show Standings for a particular competition. | /v4/competitions/{id}/standings | matchday={MATCHDAY}<br>season={YEAR}<br>date={DATE} | [Open](https://www.football-data.org/documentation/quickstart) |
| Competition / Match | List all matches for a particular competition. | /v4/competitions/{id}/matches | dateFrom={DATE}<br>dateTo={DATE}<br> stage={STAGE}<br>status={STATUS}<br>matchday={MATCHDAY}<br> group={GROUP}<br>season={YEAR} | [Open](https://www.football-data.org/documentation/quickstart) |
| Competition / Teams | List all teams for a particular competition. | /v4/competitions/{id}/teams | season={YEAR} | [Open](https://www.football-data.org/documentation/quickstart) |
| Competition / (Top)Scorers | List top scorers for a particular competition. | /v4/competitions/{id}/scorers | limit={LIMIT}<br>season={YEAR} | [Open](https://www.football-data.org/documentation/quickstart) |
| Team | Show one particular team. | /v4/teams/{id} | - | [Open](https://www.football-data.org/documentation/quickstart) |
| Team | List teams. | /v4/teams/ | limit={LIMIT}<br>offset={OFFSET} | [Open](https://www.football-data.org/documentation/quickstart) |
| Match | Show all matches for a particular team. | /v4/teams/{id}/matches/ | dateFrom={DATE}<br>dateTo={DATE}<br>season={YEAR}<br> competitions={competitionIds}<br>status={STATUS}<br>venue={VENUE}<br>limit={LIMIT} | [Open](https://www.football-data.org/documentation/quickstart) |
| Person | List one particular person. | /v4/persons/{id} | - | [Open](https://www.football-data.org/documentation/quickstart) |
| Person / Match | Show all matches for a particular person. | /v4/persons/{id}/matches | dateFrom={DATE}<br>dateTo={DATE}<br> status={STATUS}<br>competitions={competitionIds}<br> limit={LIMIT}<br>offset={OFFSET} | [Open](https://www.football-data.org/documentation/quickstart) |
| Match | Show one particular match. | /v4/matches/{id} |  | [Open](https://www.football-data.org/documentation/quickstart) |
| Match | List matches across (a set of) competitions. | /v4/matches | competitions={competitionIds}<br>ids={matchIds}<br> dateFrom={DATE}<br> dateTo={DATE}<br> status={STATUS} | [Open](https://www.football-data.org/documentation/quickstart) |
| Match / Head2Head | List previous encounters for the teams of a match. | /v4/matches/{id}/head2head | limit={LIMIT}<br>dateFrom={DATE}<br>dateTo={DATE}<br>competitions={competitionIds} | [Open](https://www.football-data.org/documentation/quickstart) |

### Filters and their data types

| Filter | Type | Description / Possible values |
| :-- | :-- | :-- |
| id | Integer /\[0-9\]+/ | The id of a resource. |
| ids | Integer /\[0-9\]+/ | Comma separated list of ids. |
| matchday | Integer /\[1-4\]+\[0-9\]\*/ |  |
| season | String /yyyy/ | The starting year of a season e.g. 2017 or 2016 |
| status | Enum /\[A-Z\]+/ | The status of a match. \[SCHEDULED \| LIVE \| IN\_PLAY \| PAUSED \| FINISHED \| POSTPONED \| SUSPENDED \| CANCELLED\] |
| venue | Enum /\[A-Z\]+/ | Defines the venue (type). \[HOME \| AWAY\] |
| date / dateFrom / dateTo | String /yyyy-MM-dd/ | e.g. 2018-06-22 |
| stage | Enum /\[A-Z\]+/ | FINAL \| THIRD\_PLACE \| SEMI\_FINALS \| QUARTER\_FINALS \| LAST\_16 \| LAST\_32 \| LAST\_64 \| ROUND\_4 \| ROUND\_3 \| ROUND\_2 \| ROUND\_1 \| GROUP\_STAGE \| PRELIMINARY\_ROUND \| QUALIFICATION \| QUALIFICATION\_ROUND\_1 \| QUALIFICATION\_ROUND\_2 \| QUALIFICATION\_ROUND\_3 \| PLAYOFF\_ROUND\_1 \| PLAYOFF\_ROUND\_2 \| PLAYOFFS \| REGULAR\_SEASON \| CLAUSURA \| APERTURA \| CHAMPIONSHIP \| RELEGATION \| RELEGATION\_ROUND |
| plan | String /\[A-Z\]+/ | TIER\_ONE \| TIER\_TWO \| TIER\_THREE \| TIER\_FOUR |
| competitions | String /\\d+,\\d+/ | Comma separated list of competition ids. |
| areas | String /\\d+,\\d+/ | Comma separated list of area ids. |
| group | String /\[A-Z\_\]+/ | Allows filtering for groupings in a competition. |
| limit | Integer /\\d+/ | Limits your result set to the given number. Defaults to 10. |
| offset | Integer /\\d+/ | Skip offset no. of records when using a limit to page the result list. |

### Example Requests

See todays' matches of your subscribed competitions:

```bash
https://api.football-data.org/v4/matches
```

Get all matches of the Champions League:

```bash
https://api.football-data.org/v4/competitions/CL/matches
```

See all upcoming matches for Real Madrid:

```bash
https://api.football-data.org/v4/teams/86/matches?status=SCHEDULED
```

Get all matches where Gigi Buffon was in the squad:

```bash
https://api.football-data.org/v4/persons/2019/matches?status=FINISHED
```

Check schedules for Premier League on matchday 11:

```bash
https://api.football-data.org/v4/competitions/PL/matches?matchday=11
```

Get the league table for Eredivisie:

```bash
https://api.football-data.org/v4/competitions/DED/standings
```

See best 10 scorers of Italy's top league (scorers subresource defaults to limit=10):

```bash
https://api.football-data.org/v4/competitions/SA/scorers
```
