import subprocess

vtt = "act_1_subtitles.vtt"
fdir = "../../fonts"
style = "Alignment=2\\,Fontname=Takeover3D"

vf = f"scale=1080:1920,crop=1080:1920,subtitles={vtt}:fontsdir={fdir}:force_style={style}"

cmd = ['ffmpeg', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720', '-vf', vf, '-t', '1', '-f', 'null', '-']
p = subprocess.run(cmd, capture_output=True, text=True)
print('STDOUT:', p.stdout)
print('STDERR:', p.stderr)
