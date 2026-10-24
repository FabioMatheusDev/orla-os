"""Generate original, short UI sounds (PCM WAV); no external samples or dependencies."""
import math
import pathlib
import struct
import wave

OUTPUT = pathlib.Path(__file__).resolve().parents[1] / 'app/src/main/res/raw'
RATE = 24000
# frequency, start time, duration, amplitude: restrained ticks, rising confirm, falling back.
SOUNDS = {
    'ui_move': [(920, 0, .032, .32), (1380, 0, .018, .10)],
    'ui_click': [(760, 0, .045, .35), (1140, .012, .035, .13)],
    'ui_select': [(880, 0, .065, .30), (1174, .045, .085, .28)],
    'ui_cancel': [(740, 0, .055, .28), (554, .035, .080, .24)],
}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, notes in SOUNDS.items():
        duration = max(start + length for _, start, length, _ in notes) + .010
        samples = []
        for index in range(math.ceil(duration * RATE)):
            time = index / RATE
            value = 0.0
            for hz, start, length, amplitude in notes:
                t = time - start
                if 0 <= t < length:
                    envelope = math.sin(math.pi * t / length) ** 2 * math.exp(-3 * t / length)
                    value += amplitude * envelope * math.sin(2 * math.pi * hz * t)
            samples.append(struct.pack('<h', round(max(-1, min(1, value)) * 32767)))
        with wave.open(str(OUTPUT / (name + '.wav')), 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes(b''.join(samples))
    print('Generated four original UI sounds.')


if __name__ == '__main__':
    main()
