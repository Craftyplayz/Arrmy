# Arrmy

One website that lets the Admin run a self-hosted *arr stack and lets Requesters ask for media of every Media Type from a single place.

## Language

### People

**Admin**:
The owner of the Plex server, who runs the stack and can change or fix anything in Arrmy.
_Avoid_: owner, superuser

**Requester**:
A friend or family member with access to the Admin's Plex server. Can request and watch media, but cannot touch the stack.
_Avoid_: friend, user, guest

### Media

**Media Type**:
A kind of media Arrmy can request: Movie, TV Show, Book, Audiobook, Music, Periodical, Comic or Manga.
_Avoid_: category, library

**Periodical**:
A newspaper or magazine title that keeps publishing new issues.
_Avoid_: newspaper, magazine (as Media Type names)

**Request**:
A Requester's ask for the smallest useful unit of a known title (a movie, chosen seasons, an album, a book, a comic series) to be added to the library. Approved the moment it is made.
_Avoid_: order, ticket

**Remove**:
Taking back a Request. Cancels it if nothing has downloaded yet; otherwise deletes the download and the files, except what another Request still wants.
_Avoid_: unrequest, delete request

**Available**:
A Request whose media is fully imported and can be watched in a Media Server.
_Avoid_: done, complete, ready

**Anime**:
A Movie or TV Show that is Japanese animation. Not a Media Type of its own: it is requested as a Movie or TV Show and filled by anime-specific Services.
_Avoid_: Anime as a Media Type

### Stack

**Stack**:
Everything Arrmy runs on the Admin's server: Services, Supporting Services, the download client and Media Servers.
_Avoid_: setup, server, homelab

**Wiring**:
Connecting the parts of the Stack to each other (API keys, download client, indexers, root folders) so Requests can flow without manual setup.
_Avoid_: configuring, linking

**Supporting Service**:
An app in the Stack that nobody requests from but that helps Services work, such as Prowlarr, Recyclarr, Bazarr or FlareSolverr.
_Avoid_: helper, sidecar

**Service**:
A self-hosted app that fills Requests for one or more Media Types, such as Radarr, LazyLibrarian or TubeArchivist.
_Avoid_: app, instance, backend, integration

**Media Server**:
A self-hosted app where Requesters watch, read or listen to what was requested, such as Plex, Kavita or Audiobookshelf.
_Avoid_: player, reader, library app

### Problems

**Problem**:
Something stopping a Request from reaching a Media Server that needs the Admin: a Missing title, a Failed Download or a Failed Import.
_Avoid_: issue, error, alert

**Missing**:
A title a Service is looking for that no indexer has a release for.
_Avoid_: not found, wanted

**Failed Download**:
A release the download client could not finish because it is dead, stalled or errored.
_Avoid_: stuck download

**Failed Import**:
A finished download that the Service could not add to the library.
_Avoid_: import error
