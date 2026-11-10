#!/bin/zsh
# Starts the game and every variation build on its own port, each in its own session so no agent session
# ending takes it down. Writes "name port pid" lines to ~/dev/sandbox/game-base-play/intro-serve/servers.txt.
cd ~/dev/sandbox/game-base-play
# Stop one with `kill <pid>` from that file, never by port.
out=intro-serve/servers.txt; : > $out
# The handbook and its links page (play.html) on 5450; the tailnet's :15401 points there.
for pair in /Users/dabot/dev/sandbox/game-look-test/design:5450 play-serve:5400 intro-serve/opus:5404 intro-serve/3d-preview:5405 intro-serve/3d-camera-cast:5406 intro-serve/look-a:5407 intro-serve/look-b:5408 intro-serve/ui-a:5409 intro-serve/ui-b:5410 intro-serve/town-a:5411 intro-serve/town-b:5412 intro-serve/sound:5413 intro-serve/sound-b:5414 intro-serve/crowd:5415; do
  dir=${pair%%:*}; port=${pair##*:}
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then echo "$dir $port already-running" >> $out; continue; fi
  log=/tmp/claude-501/serve-$(basename $dir)-$port.log
  perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' nohup bun tools/serve.mjs $dir $port > $log 2>&1 < /dev/null &
  sleep 0.4
  echo "$dir $port $(lsof -nP -tiTCP:$port -sTCP:LISTEN | head -1)" >> $out
done
cat $out
