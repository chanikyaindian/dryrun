export const interviewLessons26to50 = {
  'is-subsequence': {
    variables: ['pattern', 'text', 'matched', 'index', 'letter'],
    output: 'True',
    code: `def is_subsequence(pattern, text):
    matched = 0
    for index, letter in enumerate(text):
        if matched == len(pattern):
            break
        if letter == pattern[matched]:
            matched += 1  # Step: Match | Advance the pattern pointer when its next character appears.
        else:
            continue  # Step: Skip | Keep the pattern pointer in place and scan the next character.
    return matched == len(pattern)

print(is_subsequence("ace", "abcde"))`,
  },
  'two-sum-ii-input-array-is-sorted': {
    variables: ['nums', 'target', 'left', 'right', 'total'],
    output: '[2, 4]',
    code: `def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]  # Step: Compare sum | Check the pair at the two ends of the remaining search.
        if total == target:
            return [left + 1, right + 1]
        if total < target:
            left += 1  # Step: Raise sum | Move past the smaller number to look for a larger sum.
        else:
            right -= 1  # Step: Lower sum | Move past the larger number to look for a smaller sum.

print(two_sum_sorted([1, 3, 4, 6, 10], 9))`,
  },
  'container-with-most-water': {
    variables: ['heights', 'left', 'right', 'area', 'best'],
    output: '15',
    code: `def max_water(heights):
    left, right = 0, len(heights) - 1
    best = 0
    while left < right:
        area = (right - left) * min(heights[left], heights[right])
        best = max(best, area)  # Step: Measure area | Multiply the width by the shorter wall and keep the best area.
        if heights[left] <= heights[right]:
            left += 1  # Step: Move shorter wall | A narrower container with the same shorter wall cannot improve its area.
        else:
            right -= 1  # Step: Move shorter wall | Drop the right wall, which currently limits the water height.
    return best

print(max_water([2, 5, 1, 3, 6]))`,
  },
  '3sum': {
    variables: ['nums', 'anchor', 'left', 'right', 'total', 'triples'],
    output: '[[-2, 0, 2], [-2, 1, 1]]',
    code: `def three_sum(nums):
    nums = sorted(nums)
    triples = []
    for anchor in range(len(nums) - 2):
        if anchor > 0 and nums[anchor] == nums[anchor - 1]:
            continue  # Step: Skip duplicate anchor | This starting value has already been searched.
        left, right = anchor + 1, len(nums) - 1
        while left < right:
            total = nums[anchor] + nums[left] + nums[right]
            if total < 0:
                left += 1  # Step: Raise sum | A larger left value moves this sum toward zero.
            elif total > 0:
                right -= 1  # Step: Lower sum | A smaller right value moves this sum toward zero.
            else:
                triples.append([nums[anchor], nums[left], nums[right]])  # Step: Record triple | These three values sum to zero.
                left += 1
                right -= 1
                while left < right and nums[left] == nums[left - 1]:
                    left += 1
                while left < right and nums[right] == nums[right + 1]:
                    right -= 1
    return triples

print(three_sum([1, -2, 2, 0, -2, 1]))`,
  },
  'minimum-size-subarray-sum': {
    variables: ['nums', 'target', 'left', 'right', 'total', 'best'],
    output: '2',
    code: `def shortest_sum(target, nums):
    left = total = 0
    best = len(nums) + 1
    for right in range(len(nums)):
        total += nums[right]  # Step: Expand | Add the next positive number at the right edge.
        while total >= target:
            best = min(best, right - left + 1)  # Step: Record length | This window reaches the target and may be the shortest so far.
            total -= nums[left]
            left += 1  # Step: Shrink | Remove the leftmost number and see if the smaller window still qualifies.
    return best if best <= len(nums) else 0

print(shortest_sum(8, [2, 1, 5, 2, 4, 4]))`,
  },
  'longest-substring-without-repeating-characters': {
    variables: ['text', 'left', 'right', 'letter', 'last', 'best'],
    output: '5',
    code: `def longest_unique(text):
    left = best = 0
    last = {}
    for right in range(len(text)):
        letter = text[right]
        if last.get(letter, -1) >= left:
            left = last[letter] + 1  # Step: Drop duplicate | Jump past the previous copy of this character inside the window.
        last[letter] = right
        best = max(best, right - left + 1)  # Step: Measure window | The window has unique characters again. Compare its length with the best.
    return best

print(longest_unique("abbcade"))`,
  },
  'substring-with-concatenation-of-all-words': {
    variables: ['text', 'offset', 'left', 'right', 'word', 'counts', 'starts'],
    output: '[0, 18]',
    code: `def concatenation_starts(text, words):
    width = len(words[0])
    need = {}
    for word in words:
        need[word] = need.get(word, 0) + 1
    starts = []
    for offset in range(width):
        left = offset
        counts = {}
        size = 0
        for right in range(offset, len(text) - width + 1, width):
            word = text[right:right + width]
            if word not in need:
                counts = {}
                size = 0
                left = right + width  # Step: Reset window | An unknown word breaks any candidate at this alignment.
                continue
            counts[word] = counts.get(word, 0) + 1  # Step: Count word | Advance by a whole word and add it to this window.
            size += 1
            while counts[word] > need[word]:
                drop = text[left:left + width]
                counts[drop] -= 1
                size -= 1
                left += width  # Step: Remove surplus | Advance the left edge until this word has an allowed count.
            if size == len(words):
                starts.append(left)  # Step: Record start | The window contains exactly the required number of each word.
    return sorted(starts)

print(concatenation_starts("foobarbarthefooxxxbarfoo", ["foo", "bar"]))`,
  },
  'minimum-window-substring': {
    variables: ['text', 'left', 'right', 'letter', 'missing', 'balance', 'best'],
    output: 'BANC',
    code: `def minimum_window(text, target):
    if not target:
        return ""
    balance = {}
    for letter in target:
        balance[letter] = balance.get(letter, 0) + 1
    missing = len(target)
    left = 0
    best = ""
    for right in range(len(text)):
        letter = text[right]
        if letter in balance:
            if balance[letter] > 0:
                missing -= 1
            balance[letter] -= 1  # Step: Include target letter | Count this character against the target's remaining requirements.
        else:
            pass  # Step: Extend window | Include this character without changing the target counts.
        while missing == 0:
            if not best or right - left + 1 < len(best):
                best = text[left:right + 1]  # Step: Save smaller window | Every required character is present. Save this shorter candidate.
            drop = text[left]
            if drop in balance:
                balance[drop] += 1
                if balance[drop] > 0:
                    missing += 1
            left += 1  # Step: Shrink window | Drop the leftmost character and update the requirements it supplied.
    return best

print(minimum_window("ADOBECODEBANC", "ABC"))`,
  },
  'valid-sudoku': {
    grid: 'board',
    variables: ['board', 'row', 'col', 'digit', 'box', 'conflict'],
    output: 'False',
    code: `def valid_sudoku(board):
    rows, cols, boxes = [], [], []
    for index in range(9):
        rows.append(set())
        cols.append(set())
        boxes.append(set())
    for row in range(9):
        for col in range(9):
            digit = board[row][col]
            if digit == ".":
                continue
            box = (row // 3) * 3 + col // 3
            conflict = digit in rows[row] or digit in cols[col] or digit in boxes[box]  # Step: Check for duplicate | Check whether this digit already appears in its row, column, or box.
            if conflict:
                return False
            rows[row].add(digit)
            cols[col].add(digit)
            boxes[box].add(digit)  # Step: Record digit | Mark this digit as present in its row, column, and 3 by 3 box.
    return True

print(valid_sudoku([
    "5.8......", ".5.......", ".........",
    ".........", ".........", ".........",
    ".........", ".........", ".........",
]))`,
  },
  'spiral-matrix': {
    grid: 'matrix',
    variables: ['matrix', 'top', 'bottom', 'left', 'right', 'order'],
    output: '[1, 2, 3, 6, 9, 8, 7, 4, 5]',
    code: `def spiral(matrix):
    top, bottom = 0, len(matrix) - 1
    left, right = 0, len(matrix[0]) - 1
    order = []
    while top <= bottom and left <= right:
        row = top
        for col in range(left, right + 1):
            order.append(matrix[row][col])  # Step: Read top | Walk left to right along the top edge.
        top += 1
        col = right
        for row in range(top, bottom + 1):
            order.append(matrix[row][col])  # Step: Read right | Walk downward along the right edge.
        right -= 1
        if top <= bottom:
            row = bottom
            for col in range(right, left - 1, -1):
                order.append(matrix[row][col])  # Step: Read bottom | Walk right to left along the bottom edge.
            bottom -= 1
        if left <= right:
            col = left
            for row in range(bottom, top - 1, -1):
                order.append(matrix[row][col])  # Step: Read left | Walk upward along the left edge.
            left += 1
    return order

print(spiral([[1, 2, 3], [4, 5, 6], [7, 8, 9]]))`,
  },
  'rotate-image': {
    grid: 'matrix',
    variables: ['matrix', 'row', 'col'],
    output: '[[7, 4, 1], [8, 5, 2], [9, 6, 3]]',
    code: `def rotate(matrix):
    size = len(matrix)
    for row in range(size):
        for col in range(row + 1, size):
            matrix[row][col], matrix[col][row] = matrix[col][row], matrix[row][col]  # Step: Transpose cells | Swap the cells on opposite sides of the main diagonal.
    for row in range(size):
        matrix[row].reverse()  # Step: Reverse row | Flip each transposed row to complete a clockwise rotation.

image = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
rotate(image)
print(image)`,
  },
  'set-matrix-zeroes': {
    grid: 'matrix',
    variables: ['matrix', 'row', 'col', 'first_row', 'first_col'],
    output: '[[0, 0, 0], [0, 0, 0], [4, 0, 0]]',
    code: `def zero_matrix(matrix):
    rows, cols = len(matrix), len(matrix[0])
    first_row = 0 in matrix[0]
    first_col = False
    for row in range(rows):
        if matrix[row][0] == 0:
            first_col = True
    for row in range(1, rows):
        for col in range(1, cols):
            if matrix[row][col] == 0:
                matrix[row][0] = 0  # Step: Mark row | Use the first cell of this row as its zero-out marker.
                matrix[0][col] = 0  # Step: Mark column | Use the top cell of this column as its marker.
    for row in range(1, rows):
        for col in range(1, cols):
            if matrix[row][0] == 0 or matrix[0][col] == 0:
                matrix[row][col] = 0  # Step: Apply marker | Clear this cell when either of its markers is zero.
    if first_row:
        for col in range(cols):
            matrix[0][col] = 0  # Step: Clear first row | Apply the saved flag after the markers are no longer needed.
    if first_col:
        for row in range(rows):
            matrix[row][0] = 0  # Step: Clear first column | Apply the other saved flag.

matrix = [[1, 2, 0], [3, 0, 6], [4, 5, 7]]
zero_matrix(matrix)
print(matrix)`,
  },
  'game-of-life': {
    grid: 'board',
    variables: ['board', 'row', 'col', 'live', 'alive'],
    output: '[[0, 0, 0], [1, 1, 1], [0, 0, 0]]',
    code: `def tick(board):
    rows, cols = len(board), len(board[0])
    for row in range(rows):
        for col in range(cols):
            live = 0
            for dr in range(-1, 2):
                for dc in range(-1, 2):
                    nr, nc = row + dr, col + dc
                    if (dr or dc) and 0 <= nr < rows and 0 <= nc < cols:
                        live += board[nr][nc] & 1
            alive = board[row][col] & 1
            if live == 3 or (alive and live == 2):
                board[row][col] = board[row][col] | 2  # Step: Mark next live cell | Keep the old state in bit zero and store the next state in bit one.
    for row in range(rows):
        for col in range(cols):
            board[row][col] = board[row][col] >> 1  # Step: Commit next state | Shift the next state into place once all cells have been evaluated.

board = [[0, 1, 0], [0, 1, 0], [0, 1, 0]]
tick(board)
print(board)`,
  },
  'ransom-note': {
    variables: ['note', 'letter', 'counts'],
    output: 'False',
    code: `def can_construct(note, magazine):
    counts = {}
    for letter in magazine:
        counts[letter] = counts.get(letter, 0) + 1  # Step: Count supply | Add this available copy to the letter inventory.
    for letter in note:
        if counts.get(letter, 0) == 0:
            return False  # Step: Out of letters | No unused copy of this letter remains.
        counts[letter] -= 1  # Step: Use copy | Spend one available copy on the note.
    return True

print(can_construct("aba", "abcc"))`,
  },
  'isomorphic-strings': {
    variables: ['left', 'right', 'forward', 'reverse'],
    output: 'True\nFalse',
    code: `def isomorphic(source, target):
    if len(source) != len(target):
        return False
    forward, reverse = {}, {}
    for index in range(len(source)):
        left, right = source[index], target[index]
        if forward.get(left, right) != right or reverse.get(right, left) != left:
            return False  # Step: Reject conflict | A source letter changed its mapping or two source letters claimed one target.
        forward[left] = right
        reverse[right] = left  # Step: Record mapping | Track both directions so this pairing remains one-to-one.
    return True

print(isomorphic("egg", "add"))
print(isomorphic("ab", "aa"))`,
  },
  'word-pattern': {
    variables: ['symbol', 'word', 'forward', 'reverse'],
    output: 'True',
    code: `def follows(pattern, text):
    words = text.split()
    if len(pattern) != len(words):
        return False
    forward, reverse = {}, {}
    for index in range(len(pattern)):
        symbol, word = pattern[index], words[index]
        if forward.get(symbol, word) != word or reverse.get(word, symbol) != symbol:
            return False  # Step: Reject conflict | A symbol and word must always pair with each other.
        forward[symbol] = word
        reverse[word] = symbol  # Step: Check pairing | Record or confirm the same symbol and word in both directions.
    return True

print(follows("abba", "oak pine pine oak"))`,
  },
  'valid-anagram': {
    variables: ['letter', 'counts'],
    output: 'True',
    code: `def anagram(source, target):
    if len(source) != len(target):
        return False
    counts = {}
    for letter in source:
        counts[letter] = counts.get(letter, 0) + 1  # Step: Count source | Record each character and its multiplicity.
    for letter in target:
        if counts.get(letter, 0) == 0:
            return False  # Step: Reject extra letter | The target asks for a copy that the source cannot supply.
        counts[letter] -= 1  # Step: Match copy | Cancel this occurrence against the source inventory.
    return True

print(anagram("listen", "silent"))`,
  },
  'group-anagrams': {
    variables: ['word', 'key', 'groups'],
    output: "[['tea', 'eat'], ['tan', 'ant'], ['bat']]",
    code: `def group_anagrams(words):
    groups = {}
    for word in words:
        key = "".join(sorted(word))  # Step: Build signature | Rearrangements of the same letters produce the same sorted string.
        if key not in groups:
            groups[key] = []
        groups[key].append(word)  # Step: Add to group | Append this word to the bucket for its signature.
    return list(groups.values())

print(group_anagrams(["tea", "tan", "eat", "ant", "bat"]))`,
  },
  'two-sum': {
    variables: ['nums', 'index', 'value', 'need', 'seen'],
    output: '[1, 3]',
    code: `def two_sum(nums, target):
    seen = {}
    for index in range(len(nums)):
        value = nums[index]
        need = target - value  # Step: Find complement | Calculate the earlier value that would complete this pair.
        if need in seen:
            return [seen[need], index]  # Step: Return pair | The complement was seen at a different, earlier index.
        seen[value] = index  # Step: Remember index | Keep this value available for later complements.
    return []

print(two_sum([4, 8, 1, 3], 11))`,
  },
  'happy-number': {
    variables: ['number', 'remaining', 'digit', 'total', 'seen'],
    output: 'True\nFalse',
    code: `def happy(number):
    seen = set()
    while number != 1 and number not in seen:
        seen.add(number)  # Step: Remember value | Seeing this value again would repeat the same sequence.
        remaining, total = number, 0
        while remaining > 0:
            digit = remaining % 10
            total += digit * digit  # Step: Square digit | Add this digit's square to the next value.
            remaining //= 10
        number = total  # Step: Advance | Repeat with the sum of squares until reaching one or a cycle.
    return number == 1

print(happy(19))
print(happy(4))`,
  },
  'contains-duplicate-ii': {
    variables: ['nums', 'distance', 'index', 'value', 'last'],
    output: 'True',
    code: `def nearby_duplicate(nums, distance):
    last = {}
    for index in range(len(nums)):
        value = nums[index]
        if value in last and index - last[value] <= distance:
            return True  # Step: Find nearby pair | The last copy of this value is within the allowed distance.
        last[value] = index  # Step: Update last index | Only the closest earlier copy can give the smallest distance later.
    return False

print(nearby_duplicate([4, 2, 7, 4, 4], 2))`,
  },
  'longest-consecutive-sequence': {
    variables: ['nums', 'value', 'end', 'best'],
    output: '4',
    code: `def longest_consecutive(nums):
    unique = set(nums)
    best = 0
    for value in unique:
        if value - 1 in unique:
            continue  # Step: Skip interior | A sequence starting earlier will count this value.
        end = value
        while end + 1 in unique:
            end += 1  # Step: Extend sequence | The next integer is present even if it is elsewhere in the input.
        best = max(best, end - value + 1)  # Step: Save length | Compare this whole consecutive run with the longest one found.
    return best

print(longest_consecutive([10, 4, 1, 3, 2, 12]))`,
  },
  'summary-ranges': {
    variables: ['nums', 'start', 'end', 'ranges'],
    output: "['0->2', '4->5', '7']",
    code: `def summary_ranges(nums):
    ranges = []
    start = 0
    while start < len(nums):
        end = start
        while end + 1 < len(nums) and nums[end + 1] == nums[end] + 1:
            end += 1  # Step: Extend range | The next value is consecutive and belongs to the same range.
        if start == end:
            ranges.append(str(nums[start]))  # Step: Record singleton | A single number needs no range separator.
        else:
            ranges.append(str(nums[start]) + "->" + str(nums[end]))  # Step: Record range | Use the first and last values of the completed run.
        start = end + 1
    return ranges

print(summary_ranges([0, 1, 2, 4, 5, 7]))`,
  },
  'merge-intervals': {
    variables: ['intervals', 'start', 'end', 'merged'],
    output: '[[1, 6], [8, 12]]',
    code: `def merge_intervals(intervals):
    intervals = sorted(intervals, key=lambda pair: pair[0])
    merged = []
    for start, end in intervals:
        if not merged or start > merged[-1][1]:
            merged.append([start, end])  # Step: Start interval | A gap separates this interval from the last merged one.
        else:
            merged[-1][1] = max(merged[-1][1], end)  # Step: Merge overlap | Keep the existing start and extend to the farther end.
    return merged

print(merge_intervals([[8, 10], [1, 4], [3, 6], [10, 12]]))`,
  },
  'insert-interval': {
    variables: ['intervals', 'start', 'end', 'index', 'result'],
    output: '[[0, 1], [2, 8], [10, 11]]',
    code: `def insert_interval(intervals, new):
    start, end = new
    result = []
    index = 0
    while index < len(intervals) and intervals[index][1] < start:
        result.append(intervals[index])  # Step: Keep earlier interval | This interval ends before the new one starts.
        index += 1
    while index < len(intervals) and intervals[index][0] <= end:
        start = min(start, intervals[index][0])
        end = max(end, intervals[index][1])  # Step: Absorb overlap | Extend the new interval to cover this overlapping neighbor.
        index += 1
    result.append([start, end])  # Step: Insert combined interval | Place the merged range between the earlier and later intervals.
    return result + intervals[index:]

print(insert_interval([[0, 1], [2, 4], [5, 8], [10, 11]], [3, 6]))`,
  },
};
