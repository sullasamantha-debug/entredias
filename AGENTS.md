# Project rules

- Paginate unbounded habit history reads with `collectPages` and stable ordering; the Data API caps individual responses and truncated history breaks mark/unmark decisions.