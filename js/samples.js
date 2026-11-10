export const SAMPLES={
'Bubble sort':`arr = [5, 2, 9, 1, 6]
n = len(arr)
for i in range(n):
    for j in range(n - i - 1):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]
print(arr)`,
'Binary search':`nums = [2, 5, 8, 12, 16, 23, 38, 56]
target = 23
lo = 0
hi = len(nums) - 1
while lo <= hi:
    mid = (lo + hi) // 2
    if nums[mid] == target:
        print("found at", mid)
        break
    elif nums[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1`,
'Insertion sort':`a = [7, 3, 5, 1, 4]
for i in range(1, len(a)):
    key = a[i]
    j = i - 1
    while j >= 0 and a[j] > key:
        a[j + 1] = a[j]
        j -= 1
    a[j + 1] = key
print(a)`,
'Recursion (Fibonacci)':`def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`,
'Linked list reverse':`class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

head = Node(1)
head.next = Node(2)
head.next.next = Node(3)

prev = None
cur = head
while cur:
    nxt = cur.next
    cur.next = prev
    prev = cur
    cur = nxt
head = prev`,
'Binary search tree':`class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    else:
        root.right = insert(root.right, key)
    return root

root = None
for k in [5, 3, 8, 1, 4]:
    root = insert(root, k)`,
'BFS with queue':`from collections import deque
graph = {1: [2, 3], 2: [4], 3: [4], 4: []}
queue = deque([1])
seen = {1}
order = []
while queue:
    node = queue.popleft()
    order.append(node)
    for nb in graph[node]:
        if nb not in seen:
            seen.add(nb)
            queue.append(nb)
print(order)`,
'Sliding window':`nums = [2, 1, 5, 1, 3, 2]
k = 3
left = 0
total = 0
best = 0
for right in range(len(nums)):
    total += nums[right]
    if right - left + 1 > k:
        total -= nums[left]
        left += 1
    if right - left + 1 == k:
        best = max(best, total)
print(best)`,
'Monotonic stack':`temps = [73, 74, 75, 71, 69, 72, 76]
ans = [0] * len(temps)
stack = []
for i in range(len(temps)):
    while stack and temps[i] > temps[stack[-1]]:
        j = stack.pop()
        ans[j] = i - j
    stack.append(i)
print(ans)`,
'Kadane':`a = [-2, 1, -3, 4, -1, 2, 1]
best = cur = a[0]
for i in range(1, len(a)):
    cur = max(a[i], cur + a[i])
    best = max(best, cur)
print(best)`,
'Heap':`import heapq
heap = []
for x in [5, 3, 8, 1, 9, 2]:
    heapq.heappush(heap, x)
out = []
while heap:
    out.append(heapq.heappop(heap))
print(out)`,
'Grid DP':`n, m = 4, 4
dp = [[1] * m for _ in range(n)]
for i in range(1, n):
    for j in range(1, m):
        dp[i][j] = dp[i - 1][j] + dp[i][j - 1]
print(dp[n - 1][m - 1])`,
'Knapsack':`wt = [1, 3, 4]
val = [15, 20, 30]
cap = 4
dp = [0] * (cap + 1)
for i in range(len(wt)):
    for c in range(cap, wt[i] - 1, -1):
        dp[c] = max(dp[c], dp[c - wt[i]] + val[i])
print(dp[cap])`,
'Intervals':`intervals = [[1, 3], [8, 10], [2, 6], [15, 18]]
intervals.sort()
merged = [intervals[0]]
for s, e in intervals[1:]:
    if s <= merged[-1][1]:
        merged[-1][1] = max(merged[-1][1], e)
    else:
        merged.append([s, e])`,
'Trie':`class Node:
    def __init__(self):
        self.children = {}
        self.end = False

root = Node()
for word in ["cat", "car", "do"]:
    cur = root
    for ch in word:
        if ch not in cur.children:
            cur.children[ch] = Node()
        cur = cur.children[ch]
    cur.end = True`,
'Subsets (backtracking)':`nums = [1, 2, 3]
res = []
def dfs(i, path):
    if i == len(nums):
        res.append(path[:])
        return
    path.append(nums[i])
    dfs(i + 1, path)
    path.pop()
    dfs(i + 1, path)
dfs(0, [])
print(res)`,
'Permutations':`def permute(nums):
    result = []
    current_path = []
    used = [False] * len(nums) # Track elements already in the path

    def backtrack():
        # Base case: A complete permutation is formed
        if len(current_path) == len(nums):
            result.append(current_path.copy()) # Take a shallow copy
            return

        for i in range(len(nums)):
            # Pruning step: Skip if the element is already used
            if used[i]:
                continue

            # CHOOSE
            current_path.append(nums[i])
            used[i] = True

            # EXPLORE
            backtrack()

            # UNCHOOSE (The essential step that sets back tracking apart from plain recursion)
            current_path.pop()
            used[i] = False

    backtrack()
    return result

# Example Usage:
print(permute([1, 2, 3]))
# Output: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]`,
'Two Sum (dict)':`nums = [2, 7, 11, 15]
target = 9
seen = {}
for i in range(len(nums)):
    need = target - nums[i]
    if need in seen:
        print([seen[need], i])
        break
    seen[nums[i]] = i`};

