# shelf loan-days

Shows or sets a skill's loan length: how long new loans of it last, and how far a use or renewal moves its due date. Without a number it shows the current length; `--reset` goes back to the config's `loanDays`.

<!-- generated:cli loan-days -->
<!-- /generated -->

## What it does

A skill's loan length is its own setting if you set one, else `loanDays` from the config (30 by default), and never more than `maxLoanDays`. It is a setting of your library on this machine, not of a project, and isn't written to any lockfile.

Setting it doesn't change existing due dates. It applies from the skill's next borrow, use or renewal in each project.

Give longer loans to skills needed rarely but reliably (a migrations skill used once a month), so they aren't returned between uses. Agents change loan lengths only when you ask.

## Examples

```console
$ shelf loan-days pdf-tools
pdf-tools: loans last 30 days (the default, config loanDays)

$ shelf loan-days pdf-tools 60
pdf-tools: loans last 60 days (set for this skill)

$ shelf loan-days pdf-tools --reset
pdf-tools: loans last 30 days (the default, config loanDays)
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"pdf-tools","loanDays":30,"customLoanDays":null}}
```

`loanDays` is the effective length; `customLoanDays` is the skill's own setting, or `null` when it uses the config's.

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library. |
| `INVALID_ARGUMENT` | The days aren't a positive whole number, or both days and `--reset` were given. |
| `LOAN_LIMIT` | More days than `maxLoanDays`. |

```console
$ shelf loan-days pdf-tools 120
error: 120 days exceeds the 90-day loan limit
hint: Use 90 days or less, or raise maxLoanDays in the config
```

## Related

- [Concepts: due dates and loan length](../concepts.md#due-dates-and-loan-length)
- [Configuration](../configuration.md)
